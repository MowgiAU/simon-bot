
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../bot/utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // Trust nginx proxy for secure cookies
const logger = new Logger('API');
const db = new PrismaClient();

// Simple in-memory cache for user details: userId -> { username, avatar, timestamp }
const userCache = new Map<string, { username: string; avatar: string | null; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

const resolveUser = async (userId: string) => {
    if (!userId) return null;
    
    // Check cache
    const cached = userCache.get(userId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached;
    }

    try {
        const response = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
        });
        
        const userData = {
            username: response.data.username, // Discriminators are gone in v10 usually (pomelo)
            avatar: response.data.avatar,
            timestamp: Date.now()
        };
        
        userCache.set(userId, userData);
        return userData;
    } catch (e) {
        // If 404, maybe cache a "Unknown User" state to avoid repeated 404s?
        // For now just return null
        return null;
    }
};

// Debug middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    logger.info(`[API] ${req.method} ${req.path}`);
  }
  next();
});
app.get('/api/version', (req, res) => res.json({ version: '1.0.1', timestamp: new Date() }));


// Middleware
app.use(cors({
  origin: process.env.DASHBOARD_ORIGIN || true,
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: 'lax'
  }
}));


// Discord OAuth2 config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/auth/discord/callback';

// Helper: get bot guilds from database (where bot is present)
const getBotGuildIds = async () => {
  const guilds = await db.guild.findMany({ select: { id: true, name: true, icon: true } });
  return guilds;
};

// Discord OAuth2 endpoints
app.get('/api/auth/discord/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    prompt: 'none'
  });
  logger.info(`[Auth] Redirecting to Discord with redirect_uri: ${DISCORD_REDIRECT_URI}`);
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});


// Discord OAuth2 callback: store user, all user guilds, and mutual admin guilds
app.get('/api/auth/discord/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('No code provided');
  try {
    // Exchange code for token
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
      scope: 'identify guilds'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const { access_token, token_type } = tokenRes.data;
    // Get user info
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `${token_type} ${access_token}` }
    });
    // Get user guilds
    const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `${token_type} ${access_token}` }
    });
    const user = userRes.data;
    const userGuilds = guildsRes.data;
    // Get bot guilds from DB
    const botGuilds = await getBotGuildIds();
    
    // Find mutual guilds where user is admin/owner OR has allowed role
    const mutualAdminGuilds = [];
    const candidateGuilds = userGuilds.filter((g: any) => botGuilds.some(bg => bg.id === g.id));

    for (const guild of candidateGuilds) {
        // 1. Admin Check
        // permissions is a string in v10, but JS bitwise ops convert to 32-bit int which works for 0x8 (8)
        // For safety/strictness with large bitfields, BigInt is better, but this likely worked before.
        const permissions = BigInt(guild.permissions);
        const isAdmin = guild.owner || (permissions & BigInt(0x8)) === BigInt(0x8);

        if (isAdmin) {
            mutualAdminGuilds.push(guild);
            continue;
        }

        // 2. Role Access Check
        try {
            const access = await db.dashboardAccess.findUnique({ where: { guildId: guild.id } });
            if (access && access.allowedRoles.length > 0) {
                 // Fetch member to get roles
                 const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guild.id}/members/${user.id}`, {
                    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
                });
                const memberRoles = memberRes.data.roles || [];
                const hasRole = memberRoles.some((r: string) => access.allowedRoles.includes(r));
                
                if (hasRole) {
                    mutualAdminGuilds.push(guild);
                }
            }
        } catch (e) {
            // Ignore fetch errors
        }
    }

    req.session.user = user;
    req.session.guilds = userGuilds;
    req.session.mutualAdminGuilds = mutualAdminGuilds;
    // Save session before redirecting to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error during callback', err);
        return res.status(500).send('Session save error');
      }
      res.redirect(process.env.DASHBOARD_ORIGIN || '/');
    });
  } catch (err) {
    logger.error('Discord OAuth2 callback error', err);
    res.status(500).send('OAuth2 error');
  }
});

// Endpoint to get mutual admin guilds for logged-in user
app.get('/api/auth/mutual-guilds', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ mutualAdminGuilds: req.session.mutualAdminGuilds || [] });
});

app.get('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect(process.env.DASHBOARD_ORIGIN || '/');
  });
});

// Auth status endpoint

// Auth status endpoint (returns user and mutual admin guilds)
app.get('/api/auth/status', (req, res) => {
  if (req.session.user) {
    res.json({
      authenticated: true,
      user: req.session.user,
      mutualAdminGuilds: req.session.mutualAdminGuilds || []
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Helper to get guildId from request (for now, default to first guild)
const getGuildId = async () => {
  const guild = await db.guild.findFirst();
  return guild?.id || 'default-guild';
};

// Helper: Check if True Admin (Owner or Administrator perm)
const isTrueAdmin = (guildId: string, req: any) => {
    const userGuilds = req.session.guilds || [];
    const guild = userGuilds.find((g: any) => g.id === guildId);
    if (!guild) return false;
    const permissions = BigInt(guild.permissions);
    return Boolean(guild.owner || (permissions & BigInt(0x8)) === BigInt(0x8));
};

// Helper: Check Plugin Access
const checkPluginAccess = async (guildId: string, req: any, pluginId: string): Promise<boolean> => {
    const user = req.session.user;
    if (!user) return false;

    // 1. Check if Admin (via session cache)
    if (isTrueAdmin(guildId, req)) return true;

    // 2. Check Role Whitelist
    try {
        const settings = await db.pluginSettings.findUnique({
             where: { guildId_pluginId: { guildId, pluginId } }
        });
        
        // If settings don't exist or no roles allowed, allow ONLY Admins (which returned above)
        if (!settings || settings.allowedRoles.length === 0) return false;

        // Fetch User Roles from Discord
        const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${user.id}`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
        });
        const memberRoles = memberRes.data.roles || [];
        
        return memberRoles.some((r: string) => settings.allowedRoles.includes(r));
    } catch (e) {
        logger.error(`Access check failed for ${pluginId}`, e);
        return false;
    }
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Word Filter Plugin Settings Routes
app.get('/api/word-filter/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'word-filter')) return res.status(403).json({ error: 'Forbidden' });
    
    // Simply fetch - the bot has already created these on startup
    const settings = await db.filterSettings.findUnique({
      where: { guildId },
      include: {
        wordGroups: {
          include: {
            words: true,
          },
        },
      },
    });

    if (!settings) {
      return res.status(404).json({ error: 'Settings not found. Bot may not be initialized.' });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Failed to get word filter settings', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

app.post('/api/word-filter/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'word-filter')) return res.status(403).json({ error: 'Forbidden' });
    const { enabled, repostEnabled, excludedChannels, excludedRoles } = req.body;

    const settings = await db.filterSettings.update({
      where: { guildId },
      data: {
        enabled,
        repostEnabled,
        excludedChannels: excludedChannels || [],
        excludedRoles: excludedRoles || [],
      },
      include: {
        wordGroups: {
          include: {
            words: true,
          },
        },
      },
    });

    res.json(settings);
  } catch (error) {
    logger.error('Failed to update word filter settings', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Word Group Routes
app.post('/api/word-filter/groups/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'word-filter')) return res.status(403).json({ error: 'Forbidden' });
    const { name, replacementText, replacementEmoji, useEmoji } = req.body;

    // Settings should already exist from bot initialization
    const group = await db.wordGroup.create({
      data: {
        guildId,
        name,
        replacementText: useEmoji ? undefined : replacementText,
        replacementEmoji: useEmoji ? replacementEmoji : undefined,
        useEmoji,
      },
      include: {
        words: true,
      },
    });

    res.json(group);
  } catch (error) {
    logger.error('Failed to create word group', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

app.put('/api/word-filter/groups/:guildId/:groupId', async (req, res) => {
  try {
    const { guildId } = req.params; // Note: groupId is also there but we need guildId for permission
    if (!await checkPluginAccess(guildId, req, 'word-filter')) return res.status(403).json({ error: 'Forbidden' });
    const { groupId } = req.params;
    const { name, replacementText, replacementEmoji, useEmoji, enabled } = req.body;

    const group = await db.wordGroup.update({
      where: { id: groupId },
      data: {
        name,
        replacementText: useEmoji ? undefined : replacementText,
        replacementEmoji: useEmoji ? replacementEmoji : undefined,
        useEmoji,
        enabled,
      },
      include: {
        words: true,
      },
    });

    res.json(group);
  } catch (error) {
    logger.error('Failed to update word group', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

app.delete('/api/word-filter/groups/:guildId/:groupId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'word-filter')) return res.status(403).json({ error: 'Forbidden' });
    const { groupId } = req.params;

    await db.wordGroup.delete({
      where: { id: groupId },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete word group', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Word Routes
app.post('/api/word-filter/groups/:guildId/:groupId/words', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'word-filter')) return res.status(403).json({ error: 'Forbidden' });
    const { groupId } = req.params;
    const { word } = req.body;

    if (!word) throw new Error('Word is required');

    const wordsToAdd = word.split(',').map((w: string) => w.trim().toLowerCase()).filter((w: string) => w.length > 0);
    
    if (wordsToAdd.length === 0) throw new Error('No valid words provided');

    const results = [];
    for (const w of wordsToAdd) {
        // Use upsert to avoid duplicates seamlessly or just createMany and catch error?
        // Simple sequential create for now to report easier
        try {
            const fw = await db.filterWord.create({
                data: { groupId, word: w }
            });
            results.push(fw);
        } catch (e) {
            // Likely duplicate, ignore
        }
    }

    // If a single word was sent and failed, it might be important to let frontend know
    // But for mass add, we usually just return what succeeded or all of them
    // Let's return the updated list of words for the group to keep frontend simple
    const allWords = await db.filterWord.findMany({ where: { groupId } });

    res.json(allWords); 
  } catch (error) {
    logger.error('Failed to add word(s)', error);
    res.status(500).json({ error: 'Failed to add word(s)' });
  }
});

app.delete('/api/word-filter/groups/:guildId/:groupId/words/:wordId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'word-filter')) return res.status(403).json({ error: 'Forbidden' });
    const { wordId } = req.params;

    await db.filterWord.delete({
      where: { id: wordId },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete word', error);
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

// Guild Emojis Route
app.get('/api/guilds/:guildId/emojis', async (req, res) => {
  try {
    const { guildId } = req.params;

    // Auth check
    if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!req.session.mutualAdminGuilds?.some((g: any) => g.id === guildId)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    // Fetch directly from Discord API since we don't store emoji in DB
    const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/emojis`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`
      }
    });

    res.json(response.data);
  } catch (error) {
    logger.error('Failed to fetch guild emojis', error);
    res.status(500).json({ error: 'Failed to fetch emojis' });
  }
});

// Plugin settings routes (generic)
app.get('/api/plugins/:pluginId/settings', (req, res) => {
  res.json({ message: 'Get plugin settings' });
});

app.post('/api/plugins/:pluginId/settings', (req, res) => {
  res.json({ message: 'Update plugin settings' });
});

// Dashboard data routes
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const guilds = await db.guild.count();
    const members = await db.member.count();
    
    res.json({
      guilds,
      members,
      plugins: 1, // Word Filter
    });
  } catch (error) {
    res.json({
      guilds: 0,
      members: 0,
      plugins: 0,
    });
  }
});

// Server Stats Route (Actually logs)
app.get('/api/guilds/:guildId/logs', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { page = 1, limit = 20, action, search, userId } = req.query as any;
    
    // Auth check using Moderation OR Logger plugin access
    const hasModAccess = await checkPluginAccess(guildId, req, 'moderation');
    const hasLoggerAccess = await checkPluginAccess(guildId, req, 'logger');
    
    if (!hasModAccess && !hasLoggerAccess) return res.status(403).json({ error: 'Forbidden' });

    const whereClause: any = { guildId };

    if (action && action !== 'all') {
        whereClause.action = action;
    }

    // Filter by specific user (Actor OR Target)
    const userFilter = userId ? {
        OR: [
            { executorId: userId },
            { targetId: userId }
        ]
    } : null;

    // Filter by search text
    // Now we use the searchableText column for broad matches (names, reasons, etc)
    // AND we keep explicit ID checks for precise clicking interactions
    const searchFilter = search ? {
        OR: [
            { executorId: { contains: String(search) } },
            { targetId: { contains: String(search) } },
            { searchableText: { contains: String(search), mode: 'insensitive' } },
        ]
    } : null; // Note: if 'searchableText' is null/empty for old logs, this won't match them by name, only by ID-columns if populated. 
              // Re-importing logs fixes this.

    // Combine filters
    if (userFilter && searchFilter) {
        whereClause.AND = [userFilter, searchFilter];
    } else if (userFilter) {
        Object.assign(whereClause, userFilter);
    } else if (searchFilter) {
        Object.assign(whereClause, searchFilter);
    }

    logger.info(`[Logs Search] Guild: ${guildId}, Query: ${JSON.stringify(whereClause)}`);

    const logs = await db.actionLog.findMany({
      where: whereClause,
      include: { comments: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    });
    
    // Resolve usernames
    const enrichedLogs = await Promise.all(logs.map(async (log) => {
        const executor = log.executorId ? await resolveUser(log.executorId) : null;
        const target = log.targetId ? await resolveUser(log.targetId) : null;
        
        return {
            ...log,
            executorName: executor?.username,
            targetName: target?.username,
            executorAvatar: executor?.avatar,
            targetAvatar: target?.avatar
        };
    }));
    
    const total = await db.actionLog.count({ where: whereClause });

    res.json({
        items: enrichedLogs,
        pagination: {
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        }
    });

  } catch (error) {
    logger.error('Failed to get guild logs', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Add a comment to a log entry
app.post('/api/logs/:logId/comments', async (req, res) => {
  try {
    const { logId } = req.params;
    const { content } = req.body;
    
    if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
    
    // First fetch the log to check guild permissions
    const log = await db.actionLog.findUnique({ where: { id: logId } });
    if (!log) return res.status(404).json({ error: 'Log not found' });

    // Check if user is admin in that guild
    if (!req.session.mutualAdminGuilds?.some((g: any) => g.id === log.guildId)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const comment = await db.logComment.create({
      data: {
        logId,
        userId: req.session.user.id,
        content
      }
    });

    res.json(comment);
  } catch (error) {
    logger.error('Failed to add comment', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get notes for a user in a guild
app.get('/api/guilds/:guildId/users/:userId/notes', async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    
    if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!req.session.mutualAdminGuilds?.some((g: any) => g.id === guildId)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const notes = await db.userNote.findMany({
      where: { guildId, userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(notes);
  } catch (error) {
    logger.error('Failed to get user notes', error);
    res.status(500).json({ error: 'Failed to get user notes' });
  }
});

// Add a note to a user
app.post('/api/guilds/:guildId/users/:userId/notes', async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { content } = req.body;
    
    if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!req.session.mutualAdminGuilds?.some((g: any) => g.id === guildId)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const note = await db.userNote.create({
      data: {
        guildId,
        userId,
        adminId: req.session.user.id,
        content
      }
    });

    res.json(note);
  } catch (error: any) {
    logger.error('Failed to add user note', error);
    res.status(500).json({ error: 'Failed to add user note', details: error.message });
  }
});

// Get all tracked users (users with notes) for a guild
app.get('/api/guilds/:guildId/tracked-users', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!req.session.mutualAdminGuilds?.some((g: any) => g.id === guildId)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // Get all users who have notes in this guild
    const usersWithNotes = await db.userNote.groupBy({
      by: ['userId'],
      where: { guildId },
      _count: {
        id: true
      },
      _max: {
        createdAt: true
      }
    });
    
    // Map to a friendlier format
    const trackedUsers = await Promise.all(usersWithNotes.map(async u => {
        const userDetails = await resolveUser(u.userId);
        return {
            userId: u.userId,
            username: userDetails?.username,
            avatar: userDetails?.avatar,
            noteCount: u._count.id,
            lastNoteAt: u._max.createdAt
        };
    }));
    
    // Sort by most recently noted
    trackedUsers.sort((a, b) => {
        const timeA = a.lastNoteAt ? new Date(a.lastNoteAt).getTime() : 0;
        const timeB = b.lastNoteAt ? new Date(b.lastNoteAt).getTime() : 0;
        return timeB - timeA;
    });

    res.json(trackedUsers);
  } catch (error: any) {
    logger.error('Failed to get tracked users', error);
    res.status(500).json({ error: 'Failed to get tracked users', details: error.message });
  }
});

app.get('/api/guilds/:guildId/stats', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Auth check
    // Auth check (Stats plugin)
    if (!await checkPluginAccess(guildId, req, 'stats')) return res.status(403).json({ error: 'Forbidden' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Server Stats History
    const history = await db.serverStats.findMany({
      where: { guildId },
      orderBy: { date: 'asc' },
      take: 30, // Last 30 days
    });

    // 2. Top Channels (Last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const topChannelsRaw = await db.channelStats.groupBy({
      by: ['channelName'],
      where: { 
        guildId, 
        date: { gte: sevenDaysAgo } 
      },
      _sum: { messages: true },
      orderBy: { _sum: { messages: 'desc' } },
      take: 10,
    });
    
    const topChannels = topChannelsRaw.map(c => ({
        name: c.channelName,
        messages: c._sum.messages || 0
    }));

    // 3. Active Members (Last 24h)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const activeMembers = await db.member.count({
      where: {
        guildId,
        lastActiveAt: { gte: yesterday },
      },
    });

    // 4. Totals
    const totalsAgg = await db.serverStats.aggregate({
      where: { guildId },
      _sum: { messageCount: true, voiceMinutes: true, newBans: true },
    });
    
    // 5. Today's stats
    const todayStats = history.find(h => h.date.getTime() === today.getTime()) || null;
    
    // 6. Current Member Count - Last recorded
    const latestStat = history[history.length - 1];
    const totalMembers = latestStat?.memberCount || 0;

    res.json({
      history,
      topChannels,
      activeMembers,
      totals: {
        messages: totalsAgg._sum.messageCount || 0,
        voiceMinutes: totalsAgg._sum.voiceMinutes || 0,
        bans: totalsAgg._sum.newBans || 0,
      },
      today: todayStats,
      totalMembers
    });

  } catch (error) {
    logger.error('Failed to get guild stats', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});


// --- Moderation Settings Routes ---

// Get moderation settings
app.get('/api/guilds/:guildId/moderation', async (req, res) => {
    try {
        const { guildId } = req.params;
        // Auth check
        if (!await checkPluginAccess(guildId, req, 'moderation')) return res.status(403).json({ error: 'Forbidden' });

        const settings = await db.moderationSettings.findUnique({
            where: { guildId },
            include: { permissions: true }
        });
        
        // Return default if not exists
        if (!settings) {
            return res.json({ 
                guildId, 
                logChannelId: null, 
                dmUponAction: true, 
                permissions: [] 
            });
        }
        res.json(settings);
    } catch (e) {
        logger.error('Failed to get mod settings', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Update basic settings
app.post('/api/guilds/:guildId/moderation', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { logChannelId, dmUponAction, kickMessage, banMessage, timeoutMessage } = req.body;
        
        if (!await checkPluginAccess(guildId, req, 'moderation')) return res.status(403).json({ error: 'Forbidden' });

        const settings = await db.moderationSettings.upsert({
            where: { guildId },
            update: { logChannelId, dmUponAction, kickMessage, banMessage, timeoutMessage },
            create: { guildId, logChannelId, dmUponAction, kickMessage, banMessage, timeoutMessage },
            include: { permissions: true }
        });
        res.json(settings);
    } catch (e) {
        logger.error('Failed to update mod settings', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Update role permissions
app.post('/api/guilds/:guildId/moderation/permissions', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { roleId, permissions } = req.body;
        
        if (!await checkPluginAccess(guildId, req, 'moderation')) return res.status(403).json({ error: 'Forbidden' });

        // Ensure parent settings exist
        let settings = await db.moderationSettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await db.moderationSettings.create({ data: { guildId } });
        }

        // Upsert permissions
        const perm = await db.moderationPermission.upsert({
            where: { 
                settingsId_roleId: {
                    settingsId: settings.id,
                    roleId
                }
            },
            update: { ...permissions },
            create: {
                settingsId: settings.id,
                roleId,
                ...permissions
            }
        });
        res.json(perm);
    } catch (e) {
        logger.error('Failed to update permissions', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Proxy to get channels/roles (Generic)
app.get('/api/guilds/:guildId/channels', async (req, res) => {
    try {
        const { guildId } = req.params;
        const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
        });
        
        // Return ALL channels and let frontend filter. 
        // We only map necessary fields to reduce payload size.
        const channels = response.data
            .map((c: any) => ({
                id: c.id,
                name: c.name,
                type: c.type,
                parentId: c.parent_id,
                position: c.position
            }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
            
        res.json(channels);
    } catch (e) { 
        logger.error('Failed to fetch channels', e);
        res.status(500).json([]); 
    }
});

app.get('/api/guilds/:guildId/roles', async (req, res) => {
    try {
        const { guildId } = req.params;
        const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
        });
        res.json(response.data);
    } catch (e) { res.status(500).json([]); }
});

// --- Plugin Management Routes ---

app.get('/api/plugins/list', (req, res) => {
    try {
        const pluginsDir = path.join(__dirname, '../bot/plugins');
        logger.info(`Scanning plugins directory: ${pluginsDir}`);
        
        if (!fs.existsSync(pluginsDir)) {
            logger.warn('Plugins directory not found:', pluginsDir);
            return res.json([]);
        }

        const files = fs.readdirSync(pluginsDir);
        logger.info(`Found plugin files: ${files.join(', ')}`);

        const plugins = files
            .filter(file => file.endsWith('.ts'))
            .map(file => {
                try {
                    const content = fs.readFileSync(path.join(pluginsDir, file), 'utf-8');
                    // Regex handles optional modifiers (readonly/public), optional type annotation (: string), matches id, name, description
                    const idMatch = content.match(/(?:readonly\s+|public\s+)?id\s*(?::\s*\w+\s*)?=\s*['"]([^'"]+)['"]/);
                    const nameMatch = content.match(/(?:readonly\s+|public\s+)?name\s*(?::\s*\w+\s*)?=\s*['"]([^'"]+)['"]/);
                    const descMatch = content.match(/(?:readonly\s+|public\s+)?description\s*(?::\s*\w+\s*)?=\s*['"]([^'"]+)['"]/);

                    if (idMatch && nameMatch) {
                        return {
                            id: idMatch[1],
                            name: nameMatch[1],
                            description: descMatch ? descMatch[1] : 'No description'
                        };
                    } 
                    logger.warn(`Failed to match metadata in ${file}. ID found: ${!!idMatch}, Name found: ${!!nameMatch}`);
                    return null;
                } catch (e) {
                    logger.error(`Failed to parse plugin file ${file}`, e);
                    return null;
                }
            })
            .filter(p => p !== null);
        
        logger.info(`Returning ${plugins.length} plugins`);
        res.json(plugins);
    } catch (error) {
        logger.error('Failed to list plugins', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get all plugin settings for a guild
app.get('/api/guilds/:guildId/plugins-settings', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
        
        // Fetch DB settings
        const settings = await db.pluginSettings.findMany({
            where: { guildId }
        });
        
        // Fetch dashboard access
        const access = await db.dashboardAccess.findUnique({
            where: { guildId }
        });

        res.json({
            plugins: settings,
            access: access || { allowedRoles: [] }
        });
    } catch (e) {
        logger.error('Failed to get plugin settings', e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

// Update specific plugin
app.post('/api/guilds/:guildId/plugins/:pluginId', async (req, res) => {
    try {
        const { guildId, pluginId } = req.params;
        const { enabled, allowedRoles } = req.body;
        
        // STRICT AUTH: Only real admins can change these settings
        if (!isTrueAdmin(guildId, req)) {
             return res.status(403).json({ error: 'Only admins can manage plugins' });
        }

        const updated = await db.pluginSettings.upsert({
            where: { guildId_pluginId: { guildId, pluginId } },
            update: { enabled, allowedRoles },
            create: { guildId, pluginId, enabled, allowedRoles }
        });
        
        res.json(updated);
    } catch (e) {
        logger.error('Failed to update plugin', e);
        res.status(500).json({ error: 'Update failed' });
    }
});

// Get Guild Emojis
app.get('/api/guilds/:guildId/emojis', async (req, res) => {
    try {
        const { guildId } = req.params;
        // Basic auth check - user must have some access to this guild
        const user = req.session?.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        
        // Fetch emojis from Discord API
        const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/emojis`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
        });
        
        res.json(response.data);
    } catch (e) {
        logger.error('Failed to fetch guild emojis', e);
        res.status(500).json({ error: 'Failed to fetch emojis' });
    }
});

// Update dashboard access
app.post('/api/guilds/:guildId/access', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { allowedRoles } = req.body;
        
        // STRICT AUTH: Only real admins
        if (!isTrueAdmin(guildId, req)) {
             return res.status(403).json({ error: 'Only admins can manage access' });
        }

        const updated = await db.dashboardAccess.upsert({
            where: { guildId },
            update: { allowedRoles },
            create: { guildId, allowedRoles }
        });
        
        res.json(updated);
    } catch (e) {
        logger.error('Failed to update access', e);
        res.status(500).json({ error: 'Update failed' });
    }
});

// Get user's effective permissions for the UI
app.get('/api/guilds/:guildId/my-permissions', async (req, res) => {
    try {
        const { guildId } = req.params;
        const user = req.session?.user;
        if (!user) return res.json({ canManagePlugins: false, accessiblePlugins: [] });

        const isAdmin = isTrueAdmin(guildId, req);
        const accessiblePlugins: string[] = [];

        // If admin, they have everything
        if (isAdmin) {
            // Get all possible plugin IDs from our list helper or hardcoded
            // For now, let's just return a special flag or all knowns
            // To be consistent with the logic in checkPluginAccess, we'll perform a similar check 
            // but optimised for batch.
            // Actually, simpler: Frontend asks for features, we say yes/no.
            // But sidebar needs a list.
            
            // Return all plugins for admin
            return res.json({ 
                canManagePlugins: true, 
                accessiblePlugins: ['moderation', 'word-filter', 'logs', 'stats', 'logger', 'plugins', 'economy', 'production-feedback', 'welcome-gate'] 
            });
        }

        // For non-admins, check role whitelist
        // 1. Get user roles
        const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${user.id}`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
        });
        const memberRoles = memberRes.data.roles || [];

        // 2. Get all plugin settings for this guild
        const allSettings = await db.pluginSettings.findMany({
            where: { guildId }
        });

        // 3. Match
        for (const setting of allSettings) {
             if (setting.enabled && setting.allowedRoles.some((r: string) => memberRoles.includes(r))) {
                 accessiblePlugins.push(setting.pluginId);
             }
        }

        // Special check: Log viewing (often handled by Moderation settings or separate?)
        // Currently logs are guarded by 'moderation' plugin access in my previous edits? 
        // No, I guarded logs with 'moderation' check in the API, so that's consistent.

        res.json({
            canManagePlugins: false,
            accessiblePlugins
        });

    } catch (e) {
        logger.error('Failed to fetching permissions', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// --- Economy Plugin Routes ---

// Get Economy Settings
app.get('/api/economy/settings/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'economy')) return res.status(403).json({ error: 'Forbidden' });
        
        let settings = await db.economySettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await db.economySettings.create({ data: { guildId } });
        }
        res.json(settings);
    } catch (e) {
        logger.error('Failed get economy settings', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Update Economy Settings
app.post('/api/economy/settings/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'economy')) return res.status(403).json({ error: 'Forbidden' });
        
        const settings = await db.economySettings.upsert({
            where: { guildId },
            update: req.body,
            create: { guildId, ...req.body }
        });
        res.json(settings);
    } catch (e) {
        logger.error('Failed update economy settings', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Get Shop Items
app.get('/api/economy/items/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'economy')) return res.status(403).json({ error: 'Forbidden' });
        
        const items = await db.economyItem.findMany({ where: { guildId }, orderBy: { price: 'asc' } });
        res.json(items);
    } catch (e) {
        logger.error('Failed get items', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Create/Update Item
app.post('/api/economy/items/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'economy')) return res.status(403).json({ error: 'Forbidden' });
        
        const { id, name, description, price, type, stock, metadata } = req.body;
        
        // Validation
        if (!name || price < 0) return res.status(400).json({ error: 'Invalid data' });

        if (id) {
             const item = await db.economyItem.update({
                 where: { id },
                 data: { name, description, price, type, stock, metadata }
             });
             res.json(item);
        } else {
             const item = await db.economyItem.create({
                 data: { guildId, name, description, price, type, stock, metadata }
             });
             res.json(item);
        }
    } catch (e) {
        logger.error('Failed save item', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Delete Item
app.delete('/api/economy/items/:guildId/:itemId', async (req, res) => {
    try {
        const { guildId, itemId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'economy')) return res.status(403).json({ error: 'Forbidden' });
        
        await db.economyItem.delete({ where: { id: itemId } });
        res.json({ success: true });
    } catch (e) {
        logger.error('Failed delete item', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Update User Balance (Vault)
app.post('/api/economy/vault/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'economy')) return res.status(403).json({ error: 'Forbidden' });
        
        const { userId, amount, mode } = req.body; // mode: 'set' or 'add'
        
        // Find or create account
        let account = await db.economyAccount.findUnique({
            where: { guildId_userId: { guildId, userId } }
        });
        
        let newBalance = account ? account.balance : 0;
        
        if (mode === 'set') {
            newBalance = amount;
        } else {
            newBalance += amount;
        }

        const updated = await db.economyAccount.upsert({
            where: { guildId_userId: { guildId, userId } },
            update: { balance: newBalance },
            create: { guildId, userId, balance: newBalance }
        });

        // Log admin action
        await db.economyTransaction.create({
            data: {
                guildId,
                amount: mode === 'set' ? (amount - (account?.balance || 0)) : amount,
                type: 'ADMIN',
                reason: 'Vault Adjustment',
                toUserId: userId
            }
        });

        res.json(updated);
    } catch (e) {
        logger.error('Vault update failed', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// User Search (for Vault)
// We need to search discord users by name
app.get('/api/economy/search-users/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { q } = req.query;
        if (!await checkPluginAccess(guildId, req, 'economy')) return res.status(403).json({ error: 'Forbidden' });

        if (!q || String(q).length < 3) return res.json([]);
        
        const query = String(q).toLowerCase();

        // 1. Search DB users first (who have accounts)
        // Actually best to search Discord API if possible, but search endpoint isn't always easy.
        // We will search the members that the bot knows about (via recent cache or DB Member model if we had one synced)
        // We only have Member model for leveling/currency, so we can search `EconomyAccount` but that won't show new users.
        
        // Search Discord API via bot
        const searchRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/search?query=${query}&limit=10`, {
             headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
        });

        res.json(searchRes.data);
    } catch (e) {
        logger.error('Search failed', e);
        res.json([]);
    }
});

// --- Feedback Plugin Routes ---

// Get Feedback Settings
app.get('/api/feedback/settings/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'production-feedback')) return res.status(403).json({ error: 'Forbidden' });
        
        let settings = await db.feedbackSettings.findUnique({ where: { guildId } });
        if (!settings) {
            // Create default
             settings = await db.feedbackSettings.create({
                 data: { guildId, enabled: false }
             });
        }
        res.json(settings);
    } catch (e) {
        logger.error('Feedback settings fetch', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Update Feedback Settings
app.post('/api/feedback/settings/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'production-feedback')) return res.status(403).json({ error: 'Forbidden' });

        const updated = await db.feedbackSettings.update({
            where: { guildId },
            data: req.body
        });
        res.json(updated);
    } catch (e) {
         logger.error('Feedback settings update', e);
         res.status(500).json({ error: 'Failed' });
    }
});

// Get Feedback Queue (Pending/Unsure)
app.get('/api/feedback/queue/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'production-feedback')) return res.status(403).json({ error: 'Forbidden' });

        const queue = await db.feedbackPost.findMany({
            where: { 
                guildId,
                aiState: { in: ['PENDING', 'UNSURE'] }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Resolve user info for items
        const enriched = await Promise.all(queue.map(async (item) => {
            const user = await resolveUser(item.userId);
            return { ...item, user };
        }));

        res.json(enriched);
    } catch (e) {
        logger.error('Feedback queue fetch', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Approve/Reject Action
app.post('/api/feedback/action/:guildId/:postId', async (req, res) => {
    try {
        const { guildId, postId } = req.params;
        const { action } = req.body; // 'APPROVE' | 'DENY'
        if (!await checkPluginAccess(guildId, req, 'production-feedback')) return res.status(403).json({ error: 'Forbidden' });

        const post = await db.feedbackPost.findUnique({ where: { id: postId } });
        if (!post) return res.status(404).json({ error: 'Not Found' });

        if (action === 'DENY') {
            await db.feedbackPost.update({ where: { id: postId }, data: { aiState: 'REJECTED' } });
            return res.json({ success: true });
        }

        if (action === 'APPROVE') {
            // 1. Update DB
            await db.feedbackPost.update({ where: { id: postId }, data: { aiState: 'APPROVED' } });

            // 1b. Reward User
            try {
                const settings = await db.feedbackSettings.findUnique({ where: { guildId } });
                if (settings && settings.currencyReward > 0) {
                     await db.economyAccount.upsert({
                        where: { guildId_userId: { guildId, userId: post.userId } },
                        update: { balance: { increment: settings.currencyReward }, totalEarned: { increment: settings.currencyReward } },
                        create: { guildId, userId: post.userId, balance: settings.currencyReward, totalEarned: settings.currencyReward }
                     });
                     await db.economyTransaction.create({
                        data: {
                            guildId,
                            toUserId: post.userId,
                            amount: settings.currencyReward,
                            type: 'FEEDBACK_REWARD',
                            reason: 'Staff approved feedback'
                        }
                    });
                }
            } catch (e) {
                logger.error('Failed to reward user', e);
            }

            // 2. Logic based on type
            // If it has AUDIO, we need to REPOST it
            if (post.hasAudio && post.audioUrl) {
                // Fetch Webhook
                // We need the thread channel ID. 
                // We need a webhook in the PARENT (Forum) channel usually, because webhooks belong to channel, but can post in threads?
                // Webhooks created in a channel can post to threads in that channel using ?thread_id query param.
                
                const DISCORD_API_BASE = 'https://discord.com/api/v10';
                
                // A. Find/Create Webhook
                // We can't reuse bot-created webhooks easily unless we store them. 
                // Let's look for one named "Simon-Masquerade" or create it.
                // We need the PARENT channel (Forum ID). post.channelId stores Forum ID in our schema?
                // Schema: channelId = post.channelId? 
                // In ProductionFeedbackPlugin: channelId: channel.parentId (Forum).
                
                const forumId = post.channelId; 
                let webhookId, webhookToken;

                try {
                    const hooksRes = await axios.get(`${DISCORD_API_BASE}/channels/${forumId}/webhooks`, {
                         headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
                    });
                    const hooks = hooksRes.data;
                    const existing = hooks.find((h: any) => h.name === 'Simon-Masquerade' && h.token);
                    
                    if (existing) {
                        webhookId = existing.id;
                        webhookToken = existing.token;
                    } else {
                        const createRes = await axios.post(`${DISCORD_API_BASE}/channels/${forumId}/webhooks`, {
                            name: 'Simon-Masquerade'
                        }, { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } });
                        webhookId = createRes.data.id;
                        webhookToken = createRes.data.token;
                    }

                    // B. Execute Webhook
                    const user = await resolveUser(post.userId);
                    const avatarUrl = user?.avatar 
                        ? `https://cdn.discordapp.com/avatars/${post.userId}/${user.avatar}.png` 
                        : `https://cdn.discordapp.com/embed/avatars/${Number(post.userId) % 5}.png`;

                    // To enable the Discord Audio Player reliably, we must UPLOAD the file as an attachment.
                    // Just linking it often results in a plain link if the embed fails or is suppressed.
                    
                    try {
                        const audioRes = await axios.get(post.audioUrl, { responseType: 'stream' });
                        const filename = post.audioUrl.split('/').pop()?.split('?')[0] || 'audio.mp3';

                        const form = new FormData();
                        form.append('payload_json', JSON.stringify({
                            content: post.content || '',
                            username: user?.username || 'Producer',
                            avatar_url: avatarUrl,
                            allowed_mentions: { parse: [] }
                        }));
                        form.append('files[0]', audioRes.data, filename);

                        await axios.post(`${DISCORD_API_BASE}/webhooks/${webhookId}/${webhookToken}?thread_id=${post.threadId}`, form, {
                            headers: {
                                ...form.getHeaders() // Content-Type: multipart/form-data; boundary=...
                            }
                        });
                    } catch (uploadErr) {
                        logger.error('Failed to upload audio to webhook, falling back to link', uploadErr);
                        // Fallback to link if upload fails
                         await axios.post(`${DISCORD_API_BASE}/webhooks/${webhookId}/${webhookToken}?thread_id=${post.threadId}`, {
                            content: `${post.content || ''}\n\n${post.audioUrl}`, 
                            username: user?.username || 'Producer',
                            avatar_url: avatarUrl,
                            allowed_mentions: { parse: [] }
                        });
                    }

                } catch (webhookErr) {
                    logger.error('Webhook execution failed', webhookErr);
                }
            }

            // 3. Log Action
            await db.actionLog.create({
                data: {
                    guildId,
                    pluginId: 'production-feedback',
                    action: 'FEEDBACK_APPROVED',
                    executorId: (req.session?.user as any)?.id || 'system',
                    targetId: post.userId,
                    details: { postId: post.id, hasAudio: post.hasAudio }
                }
            });

            return res.json({ success: true });
        }
        
    } catch (e) {
        logger.error('Feedback action failed', e);
        res.status(500).json({ error: 'Failed' });
    }
});


// --- Welcome Gate Routes ---
app.get('/api/guilds/:guildId/welcome', async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        let settings = await db.welcomeGateSettings.findUnique({
             where: { guildId }
        });
        
        if (!settings) {
            settings = await db.welcomeGateSettings.create({
                data: { guildId }
            });
        }
        res.json(settings);
    } catch (e) {
        logger.error('Failed to fetch welcome settings', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/guilds/:guildId/welcome', async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { enabled, welcomeChannelId, unverifiedRoleId, verifiedRoleId, modalTitle, questions } = req.body;
        
        const settings = await db.welcomeGateSettings.upsert({
            where: { guildId },
            create: {
                guildId,
                enabled,
                welcomeChannelId,
                unverifiedRoleId,
                verifiedRoleId,
                modalTitle,
                questions
            },
            update: {
                enabled,
                welcomeChannelId,
                unverifiedRoleId,
                verifiedRoleId,
                modalTitle,
                questions
            }
        });
        
        res.json(settings);
    } catch (e) {
        logger.error('Failed to update welcome settings', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Bot Identity Routes ---
app.get('/api/bot/identity', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    // TODO: strictly check for Bot Owner/Admin here if needed.
    
    try {
        const botId = process.env.DISCORD_CLIENT_ID || 'global';
        let settings = await db.botSettings.findUnique({
            where: { botId }
        });

        if (!settings) {
            settings = await db.botSettings.create({
                data: { 
                    botId,
                    status: 'online',
                    activityType: 'PLAYING'
                }
            });
        }
        res.json(settings);
    } catch (e) {
        logger.error('Failed to fetch bot identity', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// ==========================================
// Beat Battle Routes
// ==========================================

// Get Configuration
app.get('/api/guilds/:guildId/beat-battle/config', async (req, res) => {
    const { guildId } = req.params;
    // We reuse moderation permission or need a specific one? For now assume 'canManagePlugins' check
    // If checkPluginAccess is strict, we need to register 'beat-battle' as accessible
    // For now, let's just check if user is admin or manager
    // TODO: Use checkPluginAccess(guildId, req, 'beat-battle')
    
    try {
        const config = await db.beatBattleConfig.findUnique({ where: { guildId } });
        res.json(config || {});
    } catch (e) {
        logger.error('Failed to get BB config', e);
        res.status(500).json({ error: 'Internal error' });
    }
});

// Save Configuration
app.post('/api/guilds/:guildId/beat-battle/config', async (req, res) => {
    const { guildId } = req.params;
    const data = req.body;
    
    try {
        const config = await db.beatBattleConfig.upsert({
            where: { guildId },
            create: { 
                guildId,
                announcementChannelId: data.announcementChannelId,
                submissionChannelId: data.submissionChannelId,
                archiveCategoryId: data.archiveCategoryId,
                votingEmoji: data.votingEmoji || '🔥',
                managerRoleId: data.managerRoleId
            },
            update: {
                announcementChannelId: data.announcementChannelId,
                submissionChannelId: data.submissionChannelId,
                archiveCategoryId: data.archiveCategoryId,
                votingEmoji: data.votingEmoji,
                managerRoleId: data.managerRoleId
            }
        });
        res.json(config);
    } catch (e) {
        logger.error('Failed to save BB config', e);
        res.status(500).json({ error: 'Internal error' });
    }
});

// Get Active Battle
app.get('/api/guilds/:guildId/beat-battle/current', async (req, res) => {
    const { guildId } = req.params;
    try {
        // Find latest active or setup battle
        const battle = await db.beatBattle.findFirst({
            where: { 
                guildId,
                status: { not: 'ARCHIVED' } 
            },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { submissions: true }
                }
            }
        });
        
        // Also get logs/votes overview (optional)
        
        res.json(battle);
    } catch (e) {
        res.status(500).json({ error: 'Error fetching battle' });
    }
});

// Create/Update Battle Metadata
app.post('/api/guilds/:guildId/beat-battle/manage', async (req, res) => {
    const { guildId } = req.params;
    const { battleId, title, description, number, startDate, endDate } = req.body;
    
    try {
        let battle;
        if (battleId) {
            battle = await db.beatBattle.update({
                where: { id: battleId },
                data: { title, description, number: parseInt(number), startDate, endDate }
            });
        } else {
            // Check if active one exists?
            battle = await db.beatBattle.create({
                data: {
                    guildId,
                    title,
                    description,
                    number: parseInt(number),
                    startDate,
                    endDate, // optional
                    status: 'SETUP'
                }
            });
        }
        res.json(battle);
    } catch (e) {
        logger.error('Failed to manage battle', e);
        res.status(500).json({ error: 'Error' });
    }
});

// Trigger Sequencer Actions
app.post('/api/guilds/:guildId/beat-battle/transition', async (req, res) => {
    const { guildId } = req.params;
    const { battleId, action } = req.body; // action: 'ANNOUNCE', 'OPEN_SUBS', 'START_VOTING', 'END', 'ARCHIVE'
    
    try {
        const battle = await db.beatBattle.findUnique({ where: { id: battleId } });
        if (!battle) return res.status(404).json({ error: 'Battle not found' });
        
        // This is where we would ideally call the Plugin instance directly.
        // But since API and Bot might be separate processes (PM2 separates them!), 
        // we can't call `bot.getPlugin().announce()`.
        //
        // SOLUTION: Update the DB state, and have the Bot watchdog pick it up, 
        // OR (simpler for now) just update Status here, and assume Bot watches DB? 
        // 
        // Actually, for immediate actions like "Send Announcement", DB state isn't enough. We need the bot to Act.
        // We can use a simplified "IPC" via DB or just implement the logic here IF we have the client.
        //
        // Wait, the API file imports `db`. Does it have access to `client`? NO.
        // The `bot` process has the `client`. The `api` process is separate.
        // 
        // BUT! In `h:\Simon Bot\new-simon\src\bot\index.ts` I see:
        // `pm2 start "npm run start" --name bot`
        // `pm2 start "npm run api:dev" --name api`
        //
        // They ARE separate processes.
        // This means the API cannot send Discord messages directly unless it makes a new Client (slow, rate limits).
        // Best Practice: Write a "Command" to the DB, and have the Bot poll for commands?
        // OR: Use a shared event bus (Redis).
        // OR: Since this is a small bot, maybe they run in the same process?
        // Looking at `setup-droplet.sh`: `pm2 start "npm run start"` and `pm2 start "npm run api:dev"`. Separate.
        
        // QUICK FIX: For now, I will just update the STATUS in the database.
        // The Bot Plugin needs a loop (watchdog) to detect status changes and act.
        // "Oh, status changed to ANNOUNCING? I better send the embed!"
        
        let newStatus = battle.status;
        
        switch (action) {
            case 'ANNOUNCE': newStatus = 'ANNOUNCING'; break;
            case 'OPEN_SUBS': newStatus = 'SUBMISSIONS'; break;
            case 'START_VOTING': newStatus = 'VOTING'; break;
            case 'END': newStatus = 'ENDED'; break;
            case 'ARCHIVE': newStatus = 'ARCHIVED'; break;
        }
        
        await db.beatBattle.update({
             where: { id: battleId },
             data: { status: newStatus }
        });
        
        res.json({ success: true, status: newStatus });
        
    } catch (e) {
        res.status(500).json({ error: 'Transition failed' });
    }
});


app.post('/api/bot/identity', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const botId = process.env.DISCORD_CLIENT_ID || 'global';
        const { status, activityType, activityText, username, avatarUrl } = req.body;

        const settings = await db.botSettings.upsert({
            where: { botId },
            create: {
                botId,
                status,
                activityType,
                activityText,
                username,
                avatarUrl
            },
            update: {
                status,
                activityType,
                activityText,
                username,
                avatarUrl
            }
        });

        res.json(settings);
    } catch (e) {
        logger.error('Failed to update bot identity', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('API error', err);
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`API server running on port ${PORT}`);
});
