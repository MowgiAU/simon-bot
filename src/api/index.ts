
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../bot/utils/logger';

const app = express();
app.set('trust proxy', 1); // Trust nginx proxy for secure cookies
const logger = new Logger('API');
const db = new PrismaClient();

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
    // Find mutual guilds where user is admin/owner and bot is present
    const mutualAdminGuilds = userGuilds.filter((g: any) => {
      const isAdmin = g.owner || (g.permissions & 0x8) === 0x8;
      return isAdmin && botGuilds.some(bg => bg.id === g.id);
    });
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Word Filter Plugin Settings Routes
app.get('/api/word-filter/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    
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

// Server Stats Route
app.get('/api/guilds/:guildId/logs', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { page = 1, limit = 20, action, search, userId } = req.query as any;
    
    // Auth check
    if (req.session && req.session.user) {
        if (!req.session.mutualAdminGuilds?.some((g: any) => g.id === guildId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
    } else {
        return res.status(401).json({ error: 'Not authenticated' });
    }

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
    
    const total = await db.actionLog.count({ where: whereClause });

    res.json({
        items: logs,
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
  } catch (error) {
    logger.error('Failed to add user note', error);
    res.status(500).json({ error: 'Failed to add user note' });
  }
});

app.get('/api/guilds/:guildId/stats', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Auth check
    if (req.session && req.session.user) {
        if (!req.session.mutualAdminGuilds?.some((g: any) => g.id === guildId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
    } else {
        return res.status(401).json({ error: 'Not authenticated' });
    }

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

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('API error', err);
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`API server running on port ${PORT}`);
});
