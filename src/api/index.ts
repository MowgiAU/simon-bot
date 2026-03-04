
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import axios, { AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../bot/utils/logger';
import multer from 'multer';
import { simpleParser } from 'mailparser';
import { Resend } from 'resend';
import { EmailService } from '../services/EmailService';
import { ProfileService } from '../services/ProfileService';
import { AudioService } from '../services/AudioService';
import * as mm from 'music-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configure storage for tracks and artwork
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'audio'
      ? path.resolve(process.cwd(), 'public/uploads/tracks')
      : path.resolve(process.cwd(), 'public/uploads/artwork');

    // Ensure directory exists synchronously to prevent race conditions during target upload
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for tracks
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed for the track!'));
      }
    } else if (file.fieldname === 'artwork') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for artwork!'));
      }
    } else {
      cb(null, true);
    }
  }
});

const emailService = new EmailService();
const prismaInstance = new PrismaClient();
const profileService = new ProfileService(prismaInstance);
const audioService = new AudioService(prismaInstance);

app.set('trust proxy', 1); // Trust nginx proxy for secure cookies
const logger = new Logger('API');

// --- Discord API Helper with Cache and Rate Limit Handling ---

// Memory cache for expensive Discord metadata calls
// guildId -> { channels: { data: any, timestamp: number }, roles: { data: any, timestamp: number } }
const discordCache = new Map<string, { 
    channels?: { data: any, timestamp: number }, 
    roles?: { data: any, timestamp: number } 
}>();

const CACHE_RESOURCES_TTL = 1000 * 60 * 5; // 5 minutes cache for channels/roles

const discordReq = async (method: string, path: string, data?: any): Promise<any> => {
    const isGet = method.toLowerCase() === 'get';
    const isChannelList = path.match(/^\/guilds\/\d+\/channels$/);
    const isRoleList = path.match(/^\/guilds\/\d+\/roles$/);
    
    // Check Cache for GET /guilds/:id/channels or roles
    if (isGet && (isChannelList || isRoleList)) {
        const guildId = path.split('/')[2];
        const cacheType = isChannelList ? 'channels' : 'roles';
        const guildCache = discordCache.get(guildId);
        
        if (guildCache?.[cacheType] && (Date.now() - guildCache[cacheType]!.timestamp < CACHE_RESOURCES_TTL)) {
            // logger.info(`[Discord Cache] Hit: ${cacheType} for ${guildId}`);
            return { data: guildCache[cacheType]!.data };
        }
    }

    const maxRetries = 3;
    let retryDelay = 2000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await axios({
                method,
                url: `https://discord.com/api/v10${path}`,
                headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                data,
                timeout: 10000 // 10s timeout
            });

            // Update Cache on success for GET lists
            if (isGet && (isChannelList || isRoleList)) {
                const guildId = path.split('/')[2];
                const cacheType = isChannelList ? 'channels' : 'roles';
                const existing = discordCache.get(guildId) || {};
                existing[cacheType] = { data: response.data, timestamp: Date.now() };
                discordCache.set(guildId, existing);
            }

            return response;
        } catch (e: any) {
            const isRateLimit = e.response?.status === 429;
            const isTimeout = e.code === 'ECONNABORTED' || e.response?.status === 504 || e.response?.status === 502;
            
            if ((isRateLimit || isTimeout) && i < maxRetries - 1) {
                const wait = isRateLimit ? (e.response.data.retry_after * 1000 + 500) : retryDelay;
                const statusInfo = e.response?.status ? `status ${e.response.status}` : `code ${e.code}`;
                logger.warn(`Discord API ${method} ${path} failed (${statusInfo}). Retrying in ${Math.round(wait)}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, wait));
                retryDelay *= 2; // Exponential backoff for timeouts
                continue;
            }
            throw e;
        }
    }
};

// Singleton pattern for Prisma to prevent connection exhaustion in dev
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const db = globalForPrisma.prisma || new PrismaClient({
    log: ['error', 'warn'],
});
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

// DEBUG: Log Database Connection Info
(async () => {
    try {
        const url = process.env.DATABASE_URL || '';
        const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
        logger.info(`[Database] Connecting to: ${maskedUrl}`);
        
        // Test query
        const count = await db.guild.count();
        logger.info(`[Database] Connection successful. Guild count: ${count}`);
    } catch (e: any) {
        logger.error('[Database] Connection check failed on startup', e);
    }
})();

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

// --- Global Middleware ---

// Static files for uploads (Public access) - Served first to avoid SPA/Auth redirects
const uploadsPath = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Debug middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    logger.info(`[API] ${req.method} ${req.path}`);
  }
  next();
});
// --- Internal Messaging & Notification Routes ---

// Removed redundant discordReq definition here.
// Replaced with global discordReq above for consistency.

// Get all notifications for user
app.get('/api/guilds/:guildId/notifications', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        let notifications = [];
        try {
            notifications = await (db as any).notification.findMany({
                where: { guildId, userId },
                orderBy: { createdAt: 'desc' },
                take: 20
            });
        } catch (dbErr: any) {
            logger.error(`Notification fetch failed (probably table doesn't exist): ${dbErr.message}`);
            return res.json([]); 
        }

        res.json(notifications);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Mark notifications as read
app.post('/api/guilds/:guildId/notifications/read', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        try {
            await (db as any).notification.updateMany({
                where: { guildId, userId, isRead: false },
                data: { isRead: true }
            });
        } catch (dbErr: any) {
            logger.error(`Notification update failed: ${dbErr.message}`);
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Get recent chat messages
app.get('/api/guilds/:guildId/chat-messages', async (req, res) => {
    try {
        const { guildId } = req.params;
        
        // Wrap in error handler to catch missing table errors
        let messages = [];
        try {
            messages = await (db as any).dashboardMessage.findMany({
                where: { guildId },
                orderBy: { createdAt: 'desc' },
                take: 50
            });
        } catch (dbErr: any) {
            logger.error(`DashboardMessage fetch failed (probably table doesn't exist): ${dbErr.message}`);
            return res.json([]); 
        }

        const reversedMessages = messages.reverse();

        // Resolve user names
        const resolvedMessages = await Promise.all(reversedMessages.map(async (msg: any) => {
            const user = await resolveUser(msg.senderId);
            return {
                ...msg,
                senderName: user?.username || 'Unknown',
                senderAvatar: user?.avatar || null
            };
        }));

        res.json(resolvedMessages);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Send a chat message
app.post('/api/guilds/:guildId/chat-messages', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        const { content, recipientId } = req.body;
        const userId = req.session?.user?.id;
        if (!userId || !content) return res.status(400).json({ error: 'Incomplete message data' });

        try {
            const message = await (db as any).dashboardMessage.create({
                data: {
                    guildId,
                    senderId: userId,
                    content,
                    recipientId: recipientId || null
                }
            });
            res.json(message);
        } catch (dbErr: any) {
            logger.error(`DashboardMessage create failed: ${dbErr.message}`);
            res.status(500).json({ error: 'Feature unavailable (DB setup pending)' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Get Dashboard Admin Users (for mentions)
app.get('/api/guilds/:guildId/staff', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        
        // Use individual REST call to skip bot instance attachment
        const response = await discordReq('GET', `/guilds/${guildId}/members?limit=1000`);
        const members: any[] = response.data;

        const staffRoles = await db.dashboardAccess.findUnique({ where: { guildId } });
        
        const staff = members.filter((m: any) => 
            // Check for Administrator permission manually (8)
            // m.permissions might not be in member object, check roles instead if needed
            // Actually, REST returns full member objects. Checking specific roles from DB.
            (staffRoles?.allowedRoles || []).some(roleId => m.roles.includes(roleId))
        ).map((m: any) => ({
            id: m.user.id,
            username: m.user.username,
            avatar: m.user.avatar
        }));

        res.json(staff);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch staff list' });
    }
});

app.get('/api/version', (req, res) => res.json({ version: '1.0.1', timestamp: new Date() }));


// Middleware
app.use(cors({
  origin: process.env.DASHBOARD_ORIGIN || true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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
    try {
        const guilds = await db.guild.findMany({ select: { id: true, name: true, icon: true } });
        return guilds;
    } catch (e) {
        logger.error('Failed to fetch bot guilds from DB', e);
        return [];
    }
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

        // Fetch User Roles from Discord (with 5s timeout)
        try {
            const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${user.id}`, {
                headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                timeout: 5000
            });
            const memberRoles = memberRes.data.roles || [];
            return memberRoles.some((r: string) => settings.allowedRoles.includes(r));
        } catch (discordErr: any) {
             logger.error(`Discord communication failed in checkPluginAccess: ${discordErr.message}`);
             return false;
        }
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

    // Map frontend categories to database action strings
    const CATEGORY_ACTIONS: Record<string, string[]> = {
        'MOD': ['kick', 'ban', 'unban', 'timeout', 'untimeout', 'warn', 'purge', 'member_kick', 'member_ban', 'member_timeout'],
        'AUTOMOD': ['automod_block', 'spam_detected'],
        'ROLE': ['role_create', 'role_delete', 'role_update', 'member_role_update'],
        'PROFANITY': ['message_filtered', 'profanity_detected'],
        'CURRENCY': ['item_bought', 'transaction'],
        'LINK': ['link_deleted', 'link_filtered'],
        'PIRACY': ['piracy_detected'],
        'ERROR': ['error', 'command_error']
    };

    if (action && action !== 'all') {
        const mappedActions = CATEGORY_ACTIONS[action];
        if (mappedActions) {
            whereClause.action = { in: mappedActions };
        } else {
            whereClause.action = action;
        }
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
        
        // Resolve comment authors
        const enrichedComments = await Promise.all(log.comments.map(async (c: any) => {
            const author = await resolveUser(c.userId);
            return {
                ...c,
                username: author?.username || c.userId, // Fallback to ID if not found
                avatar: author?.avatar
            };
        }));

        return {
            ...log,
            executorName: executor?.username,
            targetName: target?.username,
            executorAvatar: executor?.avatar,
            targetAvatar: target?.avatar,
            comments: enrichedComments
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

    // --- Notification Logic (Mentions) ---
    try {
        const mentionRegex = /@(\w+)|<@(\d+)>/g;
        let match: RegExpExecArray | null;
        const mentionedIds = new Set<string>();

        while ((match = mentionRegex.exec(content)) !== null) {
            if (match[2]) {
                mentionedIds.add(match[2]);
            } else if (match[1]) {
                const staffResponse = await discordReq('GET', `/guilds/${log.guildId}/members?limit=1000`);
                const members = staffResponse.data;
                const found = members.find((m: any) => m.user.username.toLowerCase() === match![1].toLowerCase());
                if (found) mentionedIds.add(found.user.id);
            }
        }

        mentionedIds.delete(req.session.user.id);

        if (mentionedIds.size > 0) {
            const senderName = req.session.user.username || 'Someone';

            try {
                await (db as any).notification.createMany({
                    data: Array.from(mentionedIds).map(targetId => ({
                        guildId: log.guildId,
                        userId: targetId,
                        type: 'mention',
                        title: 'New Mention',
                        content: `${senderName} mentioned you in an audit log comment: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
                        link: `/audit-logs?highlight=${logId}`
                    }))
                });
            } catch (dbErr: any) {
                logger.error(`Notification creation failed in mentions: ${dbErr.message}`);
            }
        }
    } catch (notifErr) {
        logger.error('Failed to process mentions', notifErr);
    }

    // Return enriched comment so UI updates immediately
    res.json({
        ...comment,
        username: req.session.user.username,
        avatar: req.session.user.avatar
    });
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

    // 6.5 Action Logs (Recent Activity)
    const recentLogs = await db.actionLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Resolve user data for logs
    const resolvedLogs = await Promise.all(recentLogs.map(async log => {
      const executor = log.executorId ? await resolveUser(log.executorId) : null;
      return {
        ...log,
        executorName: executor?.username || 'System'
      };
    }));

    // 7. Plugins Data
    const openTickets = await db.ticket.count({ where: { guildId, status: 'open' } });
    
    // Emails (Global)
    const allEmails = await emailService.getEmails('inbox');
    const unreadEmails = allEmails.filter(e => !e.read).length;

    // Economy
    const economyAgg = await db.economyAccount.aggregate({
        where: { guildId },
        _sum: { balance: true }
    });

    const welcomeSettings = await db.welcomeGateSettings.findUnique({ where: { guildId } });
    const filterSettings = await db.filterSettings.findUnique({ where: { guildId } });

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
      totalMembers,
      recentLogs: resolvedLogs,
      pluginsData: {
        tickets: { open: openTickets },
        email: { unread: unreadEmails },
        economy: { totalBalance: economyAgg._sum.balance || 0 },
        welcome: { enabled: welcomeSettings?.enabled || false },
        filter: { enabled: filterSettings?.enabled || false }
      }
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
    } catch (e: any) {
        logger.error('Failed to get mod settings', e);
        // Check for "Table not found" or "Column not found"
        if (e.code === 'P2021' || e.code === 'P2022') {
            return res.status(500).json({ error: 'Database schema mismatch. Please run "prisma db push".' });
        }
        res.status(500).json({ error: 'Failed', details: e.message });
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
        if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized' });
        const { guildId } = req.params;
        
        // Defensive check: handle null/undefined/non-array session data
        const mutualGuilds = req.session.mutualAdminGuilds || [];
        const isMutual = Array.isArray(mutualGuilds) && mutualGuilds.some((g: any) => {
            if (!g) return false;
            return (typeof g === 'string' && g === guildId) || (g.id === guildId);
        });

        if (!isMutual) {
            logger.warn(`User ${req.session.user.id} denied access to channels for ${guildId}`);
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (!process.env.DISCORD_TOKEN) {
            logger.error('CRITICAL: DISCORD_TOKEN is missing from environment');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const response = await discordReq('GET', `/guilds/${guildId}/channels`);
        
        const channels = (response.data || [])
            .map((c: any) => ({
                id: c.id,
                name: c.name,
                type: c.type,
                parentId: c.parent_id,
                position: c.position
            }))
            .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
            
        res.json(channels);
    } catch (e: any) { 
        if (axios.isAxiosError(e)) {
            logger.error(`Discord API Error (Channels): ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
            return res.status(e.response?.status || 500).json({ error: 'Discord communication failed' });
        }
        logger.error('Internal error fetching channels', e);
        res.status(500).json([]); 
    }
});

app.get('/api/guilds/:guildId/roles', async (req, res) => {
    try {
        if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized' });
        const { guildId } = req.params;

        const mutualGuilds = req.session.mutualAdminGuilds || [];
        const isMutual = Array.isArray(mutualGuilds) && mutualGuilds.some((g: any) => {
            if (!g) return false;
            return (typeof g === 'string' && g === guildId) || (g.id === guildId);
        });

        if (!isMutual) {
            logger.warn(`User ${req.session.user.id} denied role access for ${guildId}`);
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (!process.env.DISCORD_TOKEN) {
            return res.status(500).json({ error: 'Missing token' });
        }

        const response = await discordReq('GET', `/guilds/${guildId}/roles`);
        res.json(response.data || []);
    } catch (e: any) {
        if (axios.isAxiosError(e)) {
            logger.error(`Discord API Error (Roles): ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
            return res.status(e.response?.status || 500).json({ error: 'Discord failed' });
        }
        logger.error(`Internal role fetch error for ${req.params.guildId}`, e);
        res.status(500).json([]);
    }
});

// --- Plugin Management Routes ---

app.get('/api/plugins/list', (req, res) => {
    try {
          // Robust path resolution for production
          const pluginsDir = path.resolve(process.cwd(), 'src/bot/plugins');
        
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
                accessiblePlugins: ['moderation', 'word-filter', 'logs', 'stats', 'logger', 'plugins', 'economy', 'production-feedback', 'welcome-gate', 'email-client', 'tickets', 'channel-rules', 'musician-profiles', 'musician-profiles-admin', 'discover-musicians'] 
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

        // Enrich with balances
        const results = await Promise.all(searchRes.data.map(async (member: any) => {
            const account = await db.economyAccount.findUnique({
                where: { guildId_userId: { guildId, userId: member.user.id } }
            });
            return {
                ...member,
                balance: account?.balance || 0
            };
        }));

        res.json(results);
    } catch (e) {
        logger.error('Search failed', e);
        res.json([]);
    }
});

// Economy Leaderboard
app.get('/api/economy/leaderboard/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'economy')) return res.status(403).json({ error: 'Forbidden' });

        const topAccounts = await db.economyAccount.findMany({
            where: { guildId },
            orderBy: { balance: 'desc' },
            take: 10
        });

        // Fetch user details for each account
        const enriched = await Promise.all(topAccounts.map(async (acc) => {
            try {
                // Fetch from Discord
                const userRes = await axios.get(`https://discord.com/api/v10/users/${acc.userId}`, {
                    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
                });
                return {
                    userId: acc.userId,
                    username: userRes.data.username,
                    avatar: userRes.data.avatar,
                    balance: acc.balance
                };
            } catch (err) {
                return {
                    userId: acc.userId,
                    username: 'Unknown User',
                    balance: acc.balance
                };
            }
        }));

        res.json(enriched);

    } catch (e) {
        logger.error('Leaderboard fetch failed', e);
        res.status(500).json({ error: 'Failed' });
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
            
            // Delete the bot's "Intercepted / Pending Review" message if it exists
            const settings = await db.feedbackSettings.findUnique({ where: { guildId } });
            if (settings?.modLogChannelId && post.moderationMessageId) {
                // Also update the MOD LOG to show it was rejected
                try {
                     const token = process.env.DISCORD_TOKEN;
                     if (token) {
                        const { data: msg } = await axios.get(
                            `https://discord.com/api/v10/channels/${settings.modLogChannelId}/messages/${post.moderationMessageId}`,
                            { headers: { Authorization: `Bot ${token}` } }
                        );
                        if (msg) {
                             const embed = msg.embeds[0];
                             if (embed) {
                                 embed.color = 0xED4245; // Red
                                 embed.title = '❌ Rejected (Dashboard)';
                                 embed.footer = { text: 'Processed via Web Dashboard' };
                             }
                             await axios.patch(
                                `https://discord.com/api/v10/channels/${settings.modLogChannelId}/messages/${post.moderationMessageId}`,
                                { embeds: [embed], components: [] },
                                { headers: { Authorization: `Bot ${token}` } }
                             );
                        }
                     }
                } catch (e) { /* Ignore */ }
            }

            return res.json({ success: true });
        }

        if (action === 'APPROVE') {
             // 1. Update DB
             await db.feedbackPost.update({ where: { id: postId }, data: { aiState: 'APPROVED' } });
             
             const settings = await db.feedbackSettings.findUnique({ where: { guildId } });

             // Update Mod Log to GREEN
             if (settings?.modLogChannelId && post.moderationMessageId) {
                try {
                     const token = process.env.DISCORD_TOKEN;
                     if (token) {
                        const { data: msg } = await axios.get(
                            `https://discord.com/api/v10/channels/${settings.modLogChannelId}/messages/${post.moderationMessageId}`,
                            { headers: { Authorization: `Bot ${token}` } }
                        );
                        if (msg) {
                             const embed = msg.embeds[0];
                             if (embed) {
                                 embed.color = 0x57F287; // Green
                                 embed.title = '✅ Approved (Dashboard)';
                                 embed.footer = { text: 'Processed via Web Dashboard' };
                             }
                             await axios.patch(
                                `https://discord.com/api/v10/channels/${settings.modLogChannelId}/messages/${post.moderationMessageId}`,
                                { embeds: [embed], components: [] },
                                { headers: { Authorization: `Bot ${token}` } }
                             );
                        }
                     }
                } catch (e) { /* Ignore */ }
            }

            // 1b. Reward User
            try {
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
            // Ensure Guild Exists before creating settings to prevent FK errors
            const guildExists = await db.guild.findUnique({ where: { id: guildId } });
            if (!guildExists) {
                const sessionGuild = req.session.guilds?.find((g: any) => g.id === guildId);
                if (sessionGuild) {
                    await db.guild.create({
                        data: {
                            id: guildId,
                            name: sessionGuild.name,
                            icon: sessionGuild.icon || null
                        }
                    });
                }
            }

            settings = await db.welcomeGateSettings.create({
                data: { guildId }
            });
        }
        res.json(settings);
    } catch (e: any) {
        logger.error('Failed to fetch welcome settings', e);
        if (e.code === 'P2021') {
             return res.status(500).json({ error: 'Database schema mismatch. Please run "prisma db push".' });
        }
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
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
// Beat Battle Routes REMOVED
// ==========================================










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



// ==========================================
// Email Client Plugin Routes
// ==========================================

// Serve Attachments
app.get('/api/email/attachment/:filename', (req, res) => {
    // Basic security: ensure no traversal
    const filename = path.basename(req.params.filename);
    const filepath = path.join(process.cwd(), 'data', 'attachments', filename);
    
    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).send('Not found');
    }
});

// Webhook for Cloudflare Email Workers
app.post('/api/email/webhook', express.text({ type: '*/*', limit: '50mb' }), async (req, res) => {
    const start = Date.now();
    logger.info(`[Email Webhook] Hit! Headers: ${JSON.stringify(req.headers['content-type'])} Length: ${req.headers['content-length']}`);
    
    try {
        const settings = await emailService.getSettings();
        const token = req.headers['x-auth-token'];
        
        if (!settings.webhookSecret || token !== settings.webhookSecret) {
             logger.warn(`[Email Webhook] Unauthorized attempt from ${req.ip}`);
             return res.status(401).json({ error: 'Unauthorized' });
        }

        // Handle different body formats (JSON with 'raw', 'body', 'email' or just raw string)
        let rawEmail = '';
        if (typeof req.body === 'string') {
            rawEmail = req.body;
        } else if (req.body && typeof req.body === 'object') {
            rawEmail = req.body.raw || req.body.body || req.body.email || '';
        }

        if (!rawEmail) {
             // Try parsing JSON if express.text caught a JSON string
             try {
                 const json = JSON.parse(req.body);
                 rawEmail = json.raw || json.body || json.email || '';
             } catch {}
        }

        if (!rawEmail) {
            logger.error('[Email Webhook] No email body found in request');
            return res.status(400).json({ error: 'No email body found' });
        }

        logger.info(`[Email Webhook] Parsing email... Size: ${rawEmail.length} bytes`);
        const parsed = await simpleParser(rawEmail);
        logger.info(`[Email Webhook] Parsed: ${parsed.subject} from ${parsed.from?.text}`);

        const threadId = `live_${Date.now()}`;
        
        // Handle Attachments
        const attachmentsDir = path.join(process.cwd(), 'data', 'attachments');
        if (!fs.existsSync(attachmentsDir)) {
            fs.mkdirSync(attachmentsDir, { recursive: true });
        }

        const savedAttachments = [];
        if (parsed.attachments && parsed.attachments.length > 0) {
            for (const att of parsed.attachments) {
                const safeName = (att.filename || 'attachment').replace(/[^a-z0-9.]/gi, '_');
                const fileName = `${threadId}_${safeName}`;
                const filePath = path.join(attachmentsDir, fileName);
                
                // Write buffer to disk
                fs.writeFileSync(filePath, att.content);
                
                savedAttachments.push({
                    filename: att.filename || 'attachment',
                    path: fileName // Store just the filename, we serve from attachments dir
                });
            }
        }

        const newEmail = {
            threadId,
            from: parsed.from?.text || 'Unknown',
            fromEmail: parsed.from?.value?.[0]?.address || 'unknown@example.com',
            toEmail: parsed.to && Array.isArray(parsed.to) ? parsed.to[0].text : (parsed.to as any)?.text || '',
            subject: parsed.subject || '(No Subject)',
            body: parsed.html || parsed.textAsHtml || parsed.text || '',
            date: new Date().toISOString(),
            category: 'inbox' as const,
            read: false,
            notified: false,
            messageId: parsed.messageId,
            inReplyTo: parsed.inReplyTo,
            references: Array.isArray(parsed.references) ? parsed.references : (parsed.references ? [parsed.references] : []),
            attachments: savedAttachments
        };

        await emailService.addEmail(newEmail);
        res.json({ success: true });
    } catch (e) {
        logger.error('Webhook error', e);
        res.status(500).json({ error: 'Processing failed' });
    }
});

// Send Email
app.post('/api/email/send', upload.array('attachments'), async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        const settings = await emailService.getSettings();
        if (!settings.resendApiKey) return res.status(400).json({ error: 'Resend API Key not configured' });

        const { to, subject, body, replyTo, inReplyTo, references } = req.body;
        const resend = new Resend(settings.resendApiKey);

        const attachments = (req.files as Express.Multer.File[])?.map(f => ({
            filename: f.originalname,
            content: f.buffer
        })) || [];

        const from = settings.fromEmail || 'onboarding@resend.dev';
        const fromName = settings.fromName || 'Simon Bot';

        const headers: Record<string, string> = {};
        if (inReplyTo) headers['In-Reply-To'] = inReplyTo;
        if (references) headers['References'] = references;

        const { data, error } = await resend.emails.send({
            from: `${fromName} <${from}>`,
            to: [to],
            subject,
            html: body,
            replyTo: replyTo,
            headers,
            attachments
        });

        if (error) throw error;

        await emailService.addEmail({
            threadId: `sent_${Date.now()}`,
            from: `${fromName} <${from}>`,
            fromEmail: from,
            toEmail: to,
            subject,
            body,
            date: new Date().toISOString(),
            category: 'sent',
            read: true,
            notified: true // No alert for sent
        });

        res.json({ success: true, id: data?.id });

    } catch (e) {
        logger.error('Send email error', e);
        res.status(500).json({ error: 'Failed to send' + (e as any).message });
    }
});

// List Emails
app.get('/api/email/list/:category?', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const category = req.params.category || 'inbox';
    const emails = await emailService.getEmails(category);
    res.json(emails);
});

// Get Thread
app.get('/api/email/thread', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const subject = req.query.subject as string;
    if (!subject) return res.status(400).json({ error: 'Subject required' });
    
    const thread = await emailService.getThread(subject);
    res.json(thread);
});

// Update Email
app.patch('/api/email/:threadId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { updates } = req.body;
    await emailService.updateEmail(req.params.threadId, updates);
    res.json({ success: true });
});

// Get Settings
app.get('/api/email/settings', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const settings = await emailService.getSettings();
    // Mask API Key
    if (settings.resendApiKey) settings.resendApiKey = 're_...' + settings.resendApiKey.slice(-4);
    res.json(settings);
});

// Update Settings
app.post('/api/email/settings', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const updates = req.body;
    
    // If updating key, ensure we don't save the masked version
    if (updates.resendApiKey && updates.resendApiKey.startsWith('re_...')) {
        delete updates.resendApiKey;
    }
    
    await emailService.updateSettings(updates);
    res.json({ success: true });
});

// --- Ticket System Endpoints ---

// Get Ticket Settings
app.get('/api/tickets/settings/:guildId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;

    // Security check
    if (!req.session.mutualAdminGuilds?.some((g: any) => g.id === guildId)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const settings = await db.ticketSettings.findUnique({
        where: { guildId }
    });

    res.json(settings || { guildId, staffRoleIds: [], ticketCategoryId: null, transcriptChannelId: null });
});

// Update Ticket Settings
app.post('/api/tickets/settings/:guildId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;

    // Security check
    if (!req.session.mutualAdminGuilds?.some((g: any) => g.id === guildId)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { staffRoleIds, ticketCategoryId, transcriptChannelId, ticketMessage } = req.body;

    const settings = await db.ticketSettings.upsert({
        where: { guildId },
        update: {
            staffRoleIds,
            ticketCategoryId,
            transcriptChannelId,
            ticketMessage
        },
        create: {
            guildId,
            staffRoleIds: staffRoleIds || [],
            ticketCategoryId,
            transcriptChannelId,
            ticketMessage
        }
    });

    res.json(settings);
});

// List Tickets
app.get('/api/tickets/list/:guildId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;

    // Security check
    if (!req.session.mutualAdminGuilds?.some((g: any) => g.id === guildId)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { status } = req.query; // 'open' or 'closed'

    const where: any = { guildId };
    if (status) {
        where.status = status;
    }
    
    // Default to open tickets if not specified for backward compatibility, 
    // or just return all and let frontend filter
    // Let's return all and let frontend decide, OR filter.
    
    const tickets = await db.ticket.findMany({
        where,
        select: {
            id: true,
            channelId: true,
            guildId: true,
            ownerId: true,
            status: true,
            priority: true,
            createdAt: true,
            closedAt: true
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
});

// Update Ticket (Close / Priority)
app.patch('/api/tickets/:ticketId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { ticketId } = req.params;
    const { status, priority } = req.body;

    const updates: any = {};
    if (status) {
        updates.status = status;
        if (status === 'closed') updates.closedAt = new Date();
    }
    if (priority) updates.priority = priority;

    const ticket = await db.ticket.update({
        where: { id: ticketId },
        data: updates
    });

    // If priority changed, rename channel
    if (priority && ticket.channelId) {
        try {
            // Fetch channel current name
            const channelRes = await axios.get(`https://discord.com/api/v10/channels/${ticket.channelId}`, {
                headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
            });

            const currentName = channelRes.data.name;
            const emojis: Record<string, string> = {
                'low': '🟢',
                'medium': '🟡',
                'high': '🔴'
            };
            const emoji = emojis[priority] || '🟢';
            
            // Rename logic similar to bot
            let newName = currentName.replace(/^[🟢🟡🔴]-?/, '');
            newName = `${emoji}-${newName}`;

            // Only update if name changed effectively (Discord rate limit protection)
            // But if we just swap emojis, name DOES change. 
            // We'll proceed.

            await axios.patch(`https://discord.com/api/v10/channels/${ticket.channelId}`, 
                { name: newName },
                { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
            );
        } catch (e: any) {
             // 429 is Rate Limit; 404 is Channel Deleted
            if (e.response?.status !== 429 && e.response?.status !== 404) {
                logger.error(`Failed to rename channel for ticket ${ticketId}`, e);
            } else {
                 logger.warn(`Skipped renaming ticket ${ticketId} (error ${e.response?.status})`);
            }
        }
    }

    // If closing, we logic to close the ticket in the dashboard as well
    // Note: ticket is the updated object, so ticket.status IS 'closed' now.
    // We check if we *just* performed a closure (status input was 'closed').
    if (status === 'closed' && ticket.channelId) {
        // 1. Archive Messages from Discord First
        try {
            // Fetch messages from Discord (Limit 100 for now, basic archival)
            const messagesRes = await axios.get(`https://discord.com/api/v10/channels/${ticket.channelId}/messages?limit=100`, {
                headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
            });

            const discordMessages = messagesRes.data.reverse(); // Chronological

            // Save to DB
            const messageData = discordMessages.map((m: any) => ({
                ticketId: ticket.id,
                authorId: m.author.id,
                authorName: m.author.username,
                content: m.content || '',
                attachments: m.attachments.length > 0 ? JSON.stringify(m.attachments.map((a: any) => a.url)) : null,
                createdAt: new Date(m.timestamp)
            }));

            if (messageData.length > 0) {
                 // Prevent duplicates if we already archived? 
                 // Simple check: Delete existing for this ticket to avoid duplication before re-inserting, 
                 // OR just insert and assume user doesn't spam close.
                 // Safer: Delete existing first.
                 await db.ticketMessage.deleteMany({ where: { ticketId: ticket.id } });

                 await db.ticketMessage.createMany({
                     data: messageData
                 });
            }
        } catch (e: any) {
            if (e.response?.status !== 404 && e.response?.status !== 403) {
                 logger.error(`Failed to archive messages for ticket ${ticketId}`, e);
            }
        }

        // 2. Delete Channel
        try {
            await axios.delete(`https://discord.com/api/v10/channels/${ticket.channelId}`, {
                headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
            });
            
            // Channel ID is now invalid, maybe we should clear it in DB?
            // But we keep it for reference or "channelId" might be used for lookups?
            // Usually fine to keep it.
        } catch (e: any) {
            // Ignore if already deleted
            if (e.response?.status !== 404) {
                logger.error(`Failed to delete channel for ticket ${ticketId}`, e);
            }
        }
    }

    res.json(ticket);
});

// Get Messages
app.get('/api/tickets/:ticketId/messages', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { ticketId } = req.params;

    const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // If ticket is closed, fetch from DB
    if (ticket.status === 'closed') {
        const messages = await db.ticketMessage.findMany({
            where: { ticketId },
            orderBy: { createdAt: 'asc' }
        });
        return res.json(messages.map(m => ({
            id: m.id,
            author: { id: m.authorId, username: m.authorName, discriminator: '0', avatar: null },
            content: m.content,
            timestamp: m.createdAt,
            attachments: m.attachments ? JSON.parse(m.attachments as string).map((url: string) => ({ url })) : []
        })));
    }

    // If ticket is open, fetch from Discord
    try {
        const response = await axios.get(`https://discord.com/api/v10/channels/${ticket.channelId}/messages?limit=50`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
        });
        res.json(response.data.reverse()); // Oldest first
    } catch (e: any) {
        // If 404/403 (channel deleted), fallback to DB just in case we have logs
        const messages = await db.ticketMessage.findMany({
            where: { ticketId },
            orderBy: { createdAt: 'asc' }
        });
        
        if (messages.length > 0) {
             return res.json(messages.map(m => ({
                id: m.id,
                author: { id: m.authorId, username: m.authorName, discriminator: '0', avatar: null },
                content: m.content,
                timestamp: m.createdAt,
                attachments: m.attachments ? JSON.parse(m.attachments as string).map((url: string) => ({ url })) : []
            })));
        }

        res.status(500).json({ error: 'Failed to fetch messages (Channel likely deleted and no archive found)' });
    }
});

// Send Reply
app.post('/api/tickets/:ticketId/reply', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { ticketId } = req.params;
    const { content } = req.body;

    const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    try {
        // Post as Bot
        // Ideally we want to show WHO replied. We can append it to the content or use a webhook.
        // For simplicity:
        const user = req.session.user; // { id, username, discriminator, ... }
        const msgContent = `**${user.username} (Dashboard):**\n${content}`;

        await axios.post(`https://discord.com/api/v10/channels/${ticket.channelId}/messages`, {
            content: msgContent
        }, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
        });

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to send reply' });
    }
});

// --- Channel Rules & Gatekeeper Routes ---

app.get('/api/guilds/:guildId/channel-rules', async (req, res) => {
    try {
        const { guildId } = req.params;
        // Auth Check
        if (!await checkPluginAccess(guildId, req, 'channel-rules') && !isTrueAdmin(guildId, req)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const settings = await db.channelRuleSettings.findUnique({
            where: { guildId },
            include: { rules: { orderBy: { createdAt: 'desc' } } }
        });

        if (!settings) {
            return res.json({ 
                guildId, 
                approvalChannelId: null,
                rules: []
            });
        }
        res.json(settings);
    } catch (e) {
        logger.error('Failed to fetch channel rules', e);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.put('/api/guilds/:guildId/channel-rules/settings', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { approvalChannelId } = req.body;
        
        if (!await checkPluginAccess(guildId, req, 'channel-rules') && !isTrueAdmin(guildId, req)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const settings = await db.channelRuleSettings.upsert({
            where: { guildId },
            update: { approvalChannelId },
            create: { guildId, approvalChannelId }
        });
        res.json(settings);
    } catch (e) {
        logger.error('Failed to update channel rule settings', e);
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/guilds/:guildId/channel-rules', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { name, targetChannelId, type, config, action, exemptRoles, requiredRoles, enabled } = req.body;
        
        if (!await checkPluginAccess(guildId, req, 'channel-rules') && !isTrueAdmin(guildId, req)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Ensure settings exist
        let settings = await db.channelRuleSettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await db.channelRuleSettings.create({ data: { guildId } });
        }

        const rule = await db.channelRule.create({
            data: {
                guildId,
                settingsId: settings.id,
                name,
                targetChannelId,
                type,
                config: config || {},
                action,
                exemptRoles: exemptRoles || [],
                requiredRoles: requiredRoles || [],
                enabled: enabled ?? true
            }
        });
        res.json(rule);
    } catch (e: any) {
        logger.error('Failed to create rule', e);
        res.status(500).json({ error: 'Failed: ' + (e.message || e) });
    }
});

app.put('/api/guilds/:guildId/channel-rules/:ruleId', async (req, res) => {
    try {
        const { guildId, ruleId } = req.params;
        const data = req.body; // Partial update?
        
        if (!await checkPluginAccess(guildId, req, 'channel-rules') && !isTrueAdmin(guildId, req)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const rule = await db.channelRule.update({
            where: { id: ruleId },
            data: {
                name: data.name,
                targetChannelId: data.targetChannelId,
                type: data.type, // Usually type doesn't change, but ok
                config: data.config,
                action: data.action,
                exemptRoles: data.exemptRoles,
                requiredRoles: data.requiredRoles,
                enabled: data.enabled
            }
        });
        res.json(rule);
    } catch (e: any) {
        logger.error('Failed to update rule', e);
        res.status(500).json({ error: 'Failed: ' + (e.message || e) });
    }
});

app.delete('/api/guilds/:guildId/channel-rules/:ruleId', async (req, res) => {
    try {
        const { guildId, ruleId } = req.params; // guildId for double check?
        
        if (!await checkPluginAccess(guildId, req, 'channel-rules') && !isTrueAdmin(guildId, req)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.channelRule.delete({ where: { id: ruleId } });
        res.json({ success: true });
    } catch (e: any) {
        logger.error('Failed to delete rule', e);
        res.status(500).json({ error: 'Failed: ' + (e.message || e) });
    }
});

app.get('/api/guilds/:guildId/pending-reviews', async (req, res) => {
    try {
         const { guildId } = req.params;
         
         const reviews = await db.pendingReview.findMany({
             where: { guildId },
             orderBy: { createdAt: 'desc' }
         });

         // Refresh Attachment URLs (Discord Move Logic 2.0)
         const token = process.env.DISCORD_TOKEN;
         if (token) {
            const refreshedReviews = await Promise.all(reviews.map(async (review) => {
                // Only attempt refresh if we have the tracking IDs and it's a Discord CDN link
                // (Optimization: only refresh if link is > 12h old? For now, always refresh to be safe)
                if (review.approvalChannelId && review.approvalMessageId) {
                    try {
                        const { data: msg } = await axios.get(
                            `https://discord.com/api/v10/channels/${review.approvalChannelId}/messages/${review.approvalMessageId}`,
                            { headers: { Authorization: `Bot ${token}` } }
                        );
                        if (msg.attachments && msg.attachments.length > 0) {
                            // Update the URLs with fresh signed ones
                            return { 
                                ...review, 
                                attachmentUrls: msg.attachments.map((a: any) => a.url) 
                            };
                        }
                    } catch (e) {
                         // Message might be deleted or inaccessible
                         // console.error(`Failed to refresh attachments for review ${review.id}`);
                    }
                }
                return review;
            }));
            res.json(refreshedReviews);
         } else {
            res.json(reviews);
         }

    } catch (e: any) {
         logger.error('Failed to fetch pending reviews', e);
         res.status(500).json({ error: e.message });
    }
});

app.post('/api/guilds/:guildId/pending-reviews/:id/approve', async (req, res) => {
    try {
        const { guildId, id } = req.params;
        const review = await db.pendingReview.findUnique({ where: { id } });
        
        if (!review) return res.status(404).json({ error: 'Review not found' });

        // Execute Approval via Discord Webhook (using REST to avoid full bot client in API)
        // We use the Discord REST API to simulate the bot's action
        const { REST } = await import('discord.js');
        const { Routes } = await import('discord-api-types/v10'); // Dynamic import to avoid build issues if not present?
        // Actually, let's use the simpler method: standard discord.js REST if available or Axios
        
        // Use basic axios/fetch for simplicity as we just need to POST to a webhook
        // 1. Get Channel Webhooks
        const token = process.env.DISCORD_TOKEN!;
        const channelId = review.channelId;
        
        // Helper to make Discord reqs
        const discordReq = async (method: string, path: string, data?: any) => {
             return axios({
                 method,
                 url: `https://discord.com/api/v10${path}`,
                 headers: { Authorization: `Bot ${token}` },
                 data
             });
        };

        // Get Webhooks
        let webhookId, webhookToken;
        try {
            const webhooks: any[] = (await discordReq('GET', `/channels/${channelId}/webhooks`)).data;
            const botId = Buffer.from(token.split('.')[0], 'base64').toString();
            // Find our webhook
            const hook = webhooks.find(w => w.user?.id === botId);
            
            if (hook) {
                webhookId = hook.id;
                webhookToken = hook.token;
            } else {
                // Create one
                const newHook = (await discordReq('POST', `/channels/${channelId}/webhooks`, {
                    name: 'Simon Bot Proxy',
                    avatar: review.avatarUrl // technically wrong format, needs base64, but ignoring for speed or using bot avatar
                })).data;
                webhookId = newHook.id;
                webhookToken = newHook.token;
            }
        } catch (e) {
            console.error('Webhook fetch failed', e);
             return res.status(500).json({ error: 'Failed to access Discord channel' });
        }

        // Execute Webhook
        await axios.post(`https://discord.com/api/webhooks/${webhookId}/${webhookToken}`, {
            content: review.content,
            username: review.username,
            avatar_url: review.avatarUrl,
        });

        // Update Discord Approval Message (if exists)
        if (review.approvalChannelId && review.approvalMessageId) {
            try {
                // Fetch original message first to get embed
                const msg = (await discordReq('GET', `/channels/${review.approvalChannelId}/messages/${review.approvalMessageId}`)).data;
                const embed = msg.embeds[0];
                if (embed) {
                    embed.color = 0x57F287; // Green
                    embed.title = '✅ Approved (Dashboard)';
                    embed.footer = { text: 'Processed via Web Dashboard' };
                }

                await discordReq('PATCH', `/channels/${review.approvalChannelId}/messages/${review.approvalMessageId}`, {
                    components: [], // Remove buttons
                    embeds: embed ? [embed] : []
                });
            } catch (e) {
                console.error('Failed to update approval message', e);
            }
        }

        // 2. Delete from DB
        await db.pendingReview.delete({ where: { id } });
        
        // Log action
        await db.actionLog.create({
            data: {
                guildId,
                pluginId: 'channel-rules',
                action: 'message_approved_web',
                executorId: 'WEB_USER', // We should get real ID from session
                targetId: review.userId,
                details: { reviewId: id }
            }
        });

        res.json({ success: true });

    } catch (e: any) {
        logger.error('Failed to approve review', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/guilds/:guildId/pending-reviews/:id/reject', async (req, res) => {
    try {
        const { guildId, id } = req.params;
        const review = await db.pendingReview.findUnique({ where: { id } });

        if (review && review.approvalChannelId && review.approvalMessageId) {
             const token = process.env.DISCORD_TOKEN!;
             // Helper (duplicate from approve, shame on me)
             const discordReq = async (method: string, path: string, data?: any) => {
                 return axios({
                     method,
                     url: `https://discord.com/api/v10${path}`,
                     headers: { Authorization: `Bot ${token}` },
                     data
                 });
            };
            
            try {
                const msg = (await discordReq('GET', `/channels/${review.approvalChannelId}/messages/${review.approvalMessageId}`)).data;
                const embed = msg.embeds[0];
                if (embed) {
                    embed.color = 0xED4245; // Red
                    embed.title = '❌ Rejected (Dashboard)';
                    embed.footer = { text: 'Processed via Web Dashboard' };
                }
                await discordReq('PATCH', `/channels/${review.approvalChannelId}/messages/${review.approvalMessageId}`, {
                    components: [],
                    embeds: embed ? [embed] : []
                });
            } catch (e) {
                 console.error('Failed to update rejection message', e);
            }
        }

        await db.pendingReview.delete({ where: { id } });
        
        await db.actionLog.create({
            data: {
                guildId,
                pluginId: 'channel-rules',
                action: 'message_rejected_web',
                executorId: 'WEB_USER',
                targetId: review?.userId || 'UNKNOWN',
                details: { reviewId: id }
            }
        });

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Musician Profile API ---

// Post new track (Now with file uploads and metadata)
app.post('/api/musician/tracks', upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'artwork', maxCount: 1 }
]), async (req: any, res) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const audioFile = files['audio']?.[0];
        const artworkFile = files['artwork']?.[0];

        if (!audioFile) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        // 1. Initial metadata extraction
        let metadata = {
            title: req.body.title || audioFile.originalname,
            duration: 0,
            bpm: undefined as number | undefined
        };

        try {
            const parsed = await mm.parseFile(audioFile.path);
            metadata.duration = Math.round(parsed.format.duration || 0);
            if (!req.body.title && parsed.common.title) metadata.title = parsed.common.title;
        } catch (err) {
            logger.warn(`Failed to parse metadata for ${audioFile.path}: ${err}`);
        }

        // 2. Map to public URLs
        const audioUrl = `/uploads/tracks/${path.basename(audioFile.path)}`;
        const coverUrl = artworkFile ? `/uploads/artwork/${path.basename(artworkFile.path)}` : req.body.coverUrl;

        // 3. Save to database
        const track = await audioService.addTrack(userId, { 
            title: metadata.title, 
            url: audioUrl, 
            coverUrl, 
            description: req.body.description,
            duration: metadata.duration
        });

        res.json(track);
    } catch (e: any) {
        logger.error('Failed to upload track', e);
        res.status(500).json({ error: e.message });
    }
});

// Update track info
app.patch('/api/musician/tracks/:trackId', async (req: any, res) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { trackId } = req.params;
        const { title, description, isPublic } = req.body;

        // Ownership check
        const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
        if (!track || track.profile.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const updated = await db.track.update({
            where: { id: trackId },
            data: { title, description, isPublic }
        });

        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Delete track
app.delete('/api/musician/tracks/:trackId', async (req: any, res) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { trackId } = req.params;
        
        // Ensure user owns the track
        const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
        if (!track || track.profile.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

// Delete physical files
          if (track.url.startsWith('/uploads/')) {
              const filePath = path.join(process.cwd(), 'public', track.url);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
          if (track.coverUrl?.startsWith('/uploads/')) {
              const filePath = path.join(process.cwd(), 'public', track.coverUrl);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await db.track.delete({ where: { id: trackId } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Leaderboard: Top Tracks
app.get('/api/musician/leaderboards/tracks', async (req, res) => {
    try {
        const topTracks = await audioService.getTrackLeaderboard(10);
        res.json(topTracks);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Leaderboard: Top Artists
app.get('/api/musician/leaderboards/artists', async (req, res) => {
    try {
        const topArtists = await audioService.getArtistLeaderboard(10);
        res.json(topArtists);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Record Track Play (With Anti-Cheat Logic)
app.post('/api/musician/tracks/:trackId/play', async (req, res) => {
    try {
        const { trackId } = req.params;
        const { duration } = req.body;
        
        // Extract IP and UserAgent for anti-cheat
        const ip = req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0';
        const userAgent = req.headers['user-agent'];
        const userId = (req.session?.user as any)?.id;

        const result = await audioService.recordPlay(trackId, {
            ip,
            userAgent,
            userId,
            duration
        });

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Discovery (List all profiles)
app.get('/api/musician/profiles', async (req, res) => {
  try {
      const search = req.query.search as string;
      const genre = req.query.genre as string;
      const profiles = await db.musicianProfile.findMany({
          where: {
              OR: search ? [
                  { username: { contains: search, mode: 'insensitive' } },
                  { displayName: { contains: search, mode: 'insensitive' } },
                  { bio: { contains: search, mode: 'insensitive' } },
                  { hardware: { hasSome: [search] } }
              ] : undefined,
              genres: genre ? {
                  some: {
                      genre: { name: { contains: genre, mode: 'insensitive' } }
                  }
              } : undefined
          },
          include: {
              genres: { include: { genre: true } }
          },
          take: 50
      });
      res.json(profiles);
  } catch (e: any) {
      res.status(500).json({ error: e.message });
  }
});

// Public Profile Retrieval
app.get('/api/musician/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const profile = await profileService.getProfile(userId);
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json(profile);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Update Profile (Auth should be handled by a middleware, but for now we follow context guild patterns)
app.post('/api/musician/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const data = req.body;
        
        // Ensure username is present (Required by schema)
        const user = await resolveUser(userId);
        if (!data.username) {
            data.username = user ? user.username : 'Unknown Musician';
        }
        
        // Auto-update avatar from Discord
        if (user && user.avatar) {
            data.avatar = user.avatar;
        }

        // Map frontend social fields to ProfileService format
        const socials = [
            { platform: 'spotify', url: data.spotifyUrl },
            { platform: 'soundcloud', url: data.soundcloudUrl },
            { platform: 'youtube', url: data.youtubeUrl },
            { platform: 'instagram', url: data.instagramUrl },
            { platform: 'twitter', url: data.twitterUrl },
            { platform: 'website', url: data.websiteUrl }
        ].filter(s => !!s.url);

        // Basic check for common structure
        if (!data.genres) data.genres = [];
        
        // Extract IDs if passed as objects from frontend
        const genreIds = data.genres.map((g: any) => typeof g === 'string' ? g : g.id).filter(Boolean);

        const updated = await profileService.updateProfile(userId, {
            ...data,
            socials,
            genreIds
        });
        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Genre Library for Picker
app.get('/api/musician/genres', async (req, res) => {
    try {
        const genres = await profileService.getAllGenres();
        res.json(genres);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Admin: Add/Update Genre
app.post('/api/musician/genres', async (req, res) => {
    try {
        const { name, parentId } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const genre = await db.genre.upsert({
            where: { name },
            update: { parentId, slug },
            create: { name, parentId, slug }
        });
        res.json(genre);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Admin: Delete Genre
app.delete('/api/musician/genres/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.genre.delete({ where: { id } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('API error', err);
  console.error('Full API Error:', err); // Ensure visibility in console
  res.status(err.status || 500).json({ 
    error: err.message,
    details: process.env.NODE_ENV !== 'production' ? err.stack : undefined 
  });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`API server running on port ${PORT}`);
});
