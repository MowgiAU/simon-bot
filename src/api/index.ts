
import 'dotenv/config';
import express from 'express';
import type { RequestHandler } from 'express';
import cors from 'cors';
import session from 'express-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../bot/utils/logger.js';
import multer from 'multer';
import { simpleParser } from 'mailparser';
import { Resend } from 'resend';
import { EmailService } from '../services/EmailService.js';
import { ProfileService } from '../services/ProfileService.js';
import { AudioService } from '../services/AudioService.js';
import * as mm from 'music-metadata';
import { FLPParser } from '../bot/utils/FLPParser.js';
import { MediaConverter } from '../services/MediaConverter.js';
import { ProjectZipProcessor } from '../services/ProjectZipProcessor.js';
import { R2Storage } from '../services/R2Storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escapeHtml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
// Resolve to project root regardless of where PM2/node was started from.
// __dirname = .../src/api or .../dist/api → two levels up = project root.
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const app = express();

// Configure storage for tracks and artwork
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = path.join(PROJECT_ROOT, 'public/uploads/tracks');
    
    if (file.fieldname === 'artwork') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/artwork');
    } else if (file.fieldname === 'avatar') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/avatars');
    } else if (file.fieldname === 'project') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/projects');
    }

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
    fileSize: 300 * 1024 * 1024 // 300MB limit (WAV files are large uncompressed PCM)
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed for the track!'));
      }
    } else if (file.fieldname === 'artwork' || file.fieldname === 'avatar') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error(`Only image files are allowed for ${file.fieldname}!`));
      }
    } else if (file.fieldname === 'project') {
      // Accept .flp (plain project) or .zip (project + samples bundle)
      if (file.originalname.endsWith('.flp') || file.originalname.endsWith('.zip') ||
          file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
        cb(null, true);
      } else {
        cb(new Error('Only FL Studio (.flp) project files or .zip bundles are allowed!'));
      }
    } else {
      cb(null, true);
    }
  }
});

app.set('trust proxy', 1); // Trust nginx proxy for secure cookies
const logger = new Logger('API');

const CDN_BASE = (process.env.CDN_URL || 'https://cdn.fujistud.io').replace(/\/$/, '');

/**
 * Uploads a local file to R2 (if configured) and returns the CDN URL.
 * Falls back to a local public URL if R2 is not configured or upload fails.
 * Deletes the local file after a successful R2 upload.
 */
async function uploadToR2OrLocal(
    localFilePath: string,
    r2Key: string,
    contentType: string,
    localPublicUrl: string
): Promise<string> {
    if (R2Storage.isConfigured()) {
        try {
            const buffer = fs.readFileSync(localFilePath);
            const cdnUrl = await R2Storage.uploadBuffer(r2Key, buffer, contentType);
            try { fs.unlinkSync(localFilePath); } catch {}
            return cdnUrl;
        } catch (err) {
            logger.warn(`R2 upload failed for key "${r2Key}", serving from local: ${err}`);
        }
    }
    return localPublicUrl;
}

/**
 * Deletes a file from R2 (when URL is a CDN URL) or from local disk (when URL is a /uploads/ path).
 * Safe to call with null/undefined or Discord/external URLs — no-ops in those cases.
 */
async function deleteFromStorage(url: string | null | undefined): Promise<void> {
    if (!url) return;
    if (url.startsWith(CDN_BASE + '/')) {
        const key = url.slice(CDN_BASE.length + 1);
        await R2Storage.deleteObject(key);
    } else if (url.startsWith('/uploads/')) {
        const filePath = path.join(PROJECT_ROOT, 'public', url);
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }
}

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
export const db = globalForPrisma.prisma || new PrismaClient({
  log: ['error', 'warn'],
});
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

const emailService = new EmailService();
const profileService = new ProfileService(db);
const audioService = new AudioService(db);


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

// --- Global Global Middleware ---

// Helper to log administrative actions
const logAction = async (guildId: string, action: string, executorId: string, targetId: string | null = null, details: any = null) => {
    try {
        let finalGuildId = guildId;
        
        // If GLOBAL, try to find the first guild where the executor is an admin to associate the log,
        // otherwise just use the first guild in the DB as a fallback to satisfy Prisma relations.
        if (guildId === 'GLOBAL') {
            const firstGuild = await db.guild.findFirst({ select: { id: true } });
            if (firstGuild) finalGuildId = firstGuild.id;
            else return; // No guilds in DB yet
        }

        await db.actionLog.create({
            data: {
                guildId: finalGuildId,
                pluginId: 'musician-profiles',
                action,
                executorId,
                targetId,
                details,
                searchableText: `${action} ${targetId || ''} ${JSON.stringify(details || '')}`.toLowerCase()
            }
        });
    } catch (e) {
        logger.error(`Failed to create action log: ${action}`, e);
    }
};

// Static files for uploads (Public access) - Served first to avoid SPA/Auth redirects
const uploadsPath = path.join(PROJECT_ROOT, 'public', 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
console.log(`[Uploads] Serving static files from: ${uploadsPath}`);
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
app.get('/api/guilds/:guildId/chat-messages', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
        
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

            // If it's a mention or direct message, create a notification
            if (recipientId) {
                try {
                    await (db as any).notification.create({
                        data: {
                            guildId,
                            userId: recipientId,
                            type: 'mention',
                            title: 'New Mention',
                            message: `${req.session.user.username} mentioned you: "${content.substring(0, 50)}..."`,
                            link: '/dashboard'
                        }
                    });
                } catch (notifErr) {
                    logger.error(`Failed to create notification: ${notifErr}`);
                }
            }

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
        if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
        
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
  origin: process.env.DASHBOARD_ORIGIN || false,
  credentials: true
}));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            mediaSrc: ["'self'", 'blob:', 'https:'],
            connectSrc: ["'self'", 'https:'],
            fontSrc: ["'self'", 'https:', 'data:'],
        },
    },
    // Disabled: breaks SharedArrayBuffer used by audio worklets
    crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: 'lax'
  }
}));

// --- Rate Limiting ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again later.' },
});
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// --- Auth Middleware ---
const requireAuth: RequestHandler = (req, res, next) => {
    if (!req.session.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
};
const requireAdmin: RequestHandler = (req, res, next) => {
    if (!req.session.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    if (!(req.session.mutualAdminGuilds as any)?.length) {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
};


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
        'ERROR': ['error', 'command_error'],
        'PROFILES': ['profile_status_changed', 'track_status_changed', 'profile_wiped', 'track_uploaded', 'profile_updated', 'avatar_uploaded']
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
                accessiblePlugins: ['moderation', 'word-filter', 'logs', 'stats', 'logger', 'plugins', 'economy', 'production-feedback', 'welcome-gate', 'email-client', 'tickets', 'channel-rules', 'musician-profiles', 'musician-profiles-admin', 'discover-musicians', 'fuji-studio', 'beat-battle'] 
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
app.get('/api/email/attachment/:filename', (req: any, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
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
        
        if (!settings.webhookSecret || typeof token !== 'string' ||
            token.length !== settings.webhookSecret.length ||
            !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(settings.webhookSecret))) {
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
  { name: 'artwork', maxCount: 1 },
  { name: 'project', maxCount: 1 } // Optional .flp project file
]), async (req: any, res) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const audioFile = files['audio']?.[0];
        const artworkFile = files['artwork']?.[0];
        const projectFile = files['project']?.[0];

        if (!audioFile) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        // Parse project file (.flp) or process ZIP bundle if provided
        let arrangement: object | null = null;
        let projectFileUrl: string | null = null;
        let projectZipUrl: string | null = null;
        let projectFileSizeBytes: number | null = null;
        const isZipUpload = projectFile?.originalname.endsWith('.zip');

        if (projectFile && !isZipUpload) {
            // Plain .flp — parse arrangement only
            try {
                const flpBuffer = fs.readFileSync(projectFile.path);
                arrangement = FLPParser.parse(flpBuffer);
                projectFileUrl = `/uploads/projects/${path.basename(projectFile.path)}`;
                const arr = arrangement as any;
                logger.info(`Parsed FLP arrangement: ${projectFile.originalname} — BPM: ${arr?.bpm}, tracks: ${arr?.tracks?.length}, clips: ${arr?.tracks?.reduce((n: number, t: any) => n + t.clips.length, 0)}`);
            } catch (e) {
                logger.warn(`Failed to parse FLP file: ${projectFile.originalname} - ${e}`);
                // Continue without arrangement — don't block the upload
            }
        } else if (projectFile && isZipUpload) {
            // .zip bundle — will be processed after track is created (we need trackId first)
            projectFileSizeBytes = projectFile.size;
            projectZipUrl = `/uploads/projects/${path.basename(projectFile.path)}`;
            if (!R2Storage.isConfigured()) {
                logger.info('R2 not configured — ZIP samples will be served from local storage');
            }
        }

        // 1. Initial metadata extraction
        let metadata = {
            title: req.body.title || audioFile.originalname,
            duration: 0,
            bpm: undefined as number | undefined,
            artist: req.body.artist || undefined,
            album: req.body.album || undefined,
            year: req.body.year ? parseInt(req.body.year) : undefined,
            key: req.body.key || undefined,
        };

        try {
            const parsed = await mm.parseFile(audioFile.path);
            metadata.duration = Math.round(parsed.format.duration || 0);
            if (!req.body.title && parsed.common.title) metadata.title = parsed.common.title;
            // Auto-fill from ID3 if user didn't supply
            if (!metadata.artist && parsed.common.artist) metadata.artist = parsed.common.artist;
            if (!metadata.album && parsed.common.album) metadata.album = parsed.common.album;
            if (!metadata.year && parsed.common.year) metadata.year = parsed.common.year;
            if (parsed.common.bpm) metadata.bpm = Math.round(parsed.common.bpm);
        } catch (err) {
            logger.warn(`Failed to parse metadata for ${audioFile.path}: ${err}`);
        }

        // Override BPM if user provided it
        if (req.body.bpm) metadata.bpm = parseInt(req.body.bpm);

        // If user provided BPM, also override the arrangement's auto-detected BPM
        // (FL Studio's binary often stores default 140, which is unreliable)
        if (arrangement && metadata.bpm) {
            (arrangement as any).bpm = metadata.bpm;
        }

        // 2. Convert to space-saving formats, then map to public URLs
        const finalAudioPath = await MediaConverter.convertAudio(audioFile.path);
        const finalArtworkPath = artworkFile ? await MediaConverter.optimizeImage(artworkFile.path) : null;

        const audioUrl = `/uploads/tracks/${path.basename(finalAudioPath)}`;
        const coverUrl = finalArtworkPath ? `/uploads/artwork/${path.basename(finalArtworkPath)}` : req.body.coverUrl;

        // Create slug from title
        const slug = metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // 3. Save to database
        const track = await audioService.addTrack(userId, { 
            title: metadata.title, 
            slug,
            url: audioUrl, 
            coverUrl, 
            description: req.body.description,
            duration: metadata.duration,
            artist: metadata.artist,
            album: metadata.album,
            year: metadata.year,
            bpm: metadata.bpm,
            key: metadata.key,
            allowAudioDownload: req.body.allowAudioDownload === 'true',
            allowProjectDownload: req.body.allowProjectDownload === 'true',
            ...(arrangement ? { arrangement } : {}),
            ...(projectFileUrl ? { projectFileUrl } : {}),
            ...(projectZipUrl ? { projectZipUrl } : {}),
            ...(projectFileSizeBytes != null ? { projectFileSizeBytes } : {}),
        });

        // Log track upload
        await logAction('GLOBAL', 'track_uploaded', userId, track.id, { title: track.title });

        // Upload audio, artwork, and FLP project files to R2 (now that we have track.id for key naming).
        // ZIP is handled later (after processing) so the local file is still available for sample extraction.
        const r2UrlUpdates: any = {};

        const r2AudioKey = `tracks/${track.id}/audio/${path.basename(finalAudioPath)}`;
        const cdnAudioUrl = await uploadToR2OrLocal(finalAudioPath, r2AudioKey, 'audio/mpeg', audioUrl);
        if (cdnAudioUrl !== audioUrl) r2UrlUpdates.url = cdnAudioUrl;

        if (finalArtworkPath) {
            const localArtworkUrl = `/uploads/artwork/${path.basename(finalArtworkPath)}`;
            const r2ArtworkKey = `tracks/${track.id}/artwork/${path.basename(finalArtworkPath)}`;
            const cdnArtworkUrl = await uploadToR2OrLocal(finalArtworkPath, r2ArtworkKey, 'image/webp', localArtworkUrl);
            if (cdnArtworkUrl !== localArtworkUrl) r2UrlUpdates.coverUrl = cdnArtworkUrl;
        }

        if (projectFileUrl && projectFile && !isZipUpload) {
            const r2ProjectKey = `tracks/${track.id}/project/${path.basename(projectFile.path)}`;
            const cdnProjectUrl = await uploadToR2OrLocal(projectFile.path, r2ProjectKey, 'application/octet-stream', projectFileUrl);
            if (cdnProjectUrl !== projectFileUrl) r2UrlUpdates.projectFileUrl = cdnProjectUrl;
        }

        if (Object.keys(r2UrlUpdates).length > 0) {
            await db.track.update({ where: { id: track.id }, data: r2UrlUpdates });
        }

        // Process ZIP bundle (async — enriches arrangement and creates TrackSample rows)
        if (projectFile && isZipUpload) {
            try {
                const { arrangement: enrichedArr, sampleCount } = await ProjectZipProcessor.process(
                    projectFile.path,
                    track.id,
                    db,
                );
                // Merge user-supplied BPM into enriched arrangement
                if (metadata.bpm) (enrichedArr as any).bpm = metadata.bpm;
                await db.track.update({
                    where: { id: track.id },
                    data: { arrangement: enrichedArr },
                });
                logger.info(`ZIP processed: ${sampleCount} samples for track ${track.id}`);
            } catch (zipErr: any) {
                logger.warn(`ZIP processing failed for track ${track.id}: ${zipErr.message}`);
                // Non-fatal: track is already saved, just without waveform data
            }
            // Upload ZIP to R2 after processing (ProjectZipProcessor needs the local file first)
            const r2ZipKey = `tracks/${track.id}/project/${path.basename(projectFile.path)}`;
            const cdnZipUrl = await uploadToR2OrLocal(projectFile.path, r2ZipKey, 'application/zip', projectZipUrl!);
            if (cdnZipUrl !== projectZipUrl) {
                await db.track.update({ where: { id: track.id }, data: { projectZipUrl: cdnZipUrl } });
            }
        }

        // 4. Handle genre tags for this track
        const genreIds = req.body.genreIds;
        logger.info(`[Upload] Processing genreIds for track ${track.id}: ${genreIds} (type: ${typeof genreIds})`);
        if (genreIds) {
            let ids: string[] = [];
            try {
                ids = typeof genreIds === 'string' ? JSON.parse(genreIds) : genreIds;
            } catch (e) {
                logger.warn(`[Upload] Failed to parse genreIds as JSON: ${genreIds}`);
                if (typeof genreIds === 'string') ids = [genreIds];
            }
            
            if (Array.isArray(ids) && ids.length > 0) {
                const validIds = ids.filter(id => typeof id === 'string' && id.length > 0);
                logger.info(`[Upload] Creating ${validIds.length} track-genre links for track ${track.id}`);
                await db.trackGenre.createMany({
                    data: validIds.map((gid: string) => ({ trackId: track.id, genreId: gid })),
                    skipDuplicates: true
                });
            }
        }

        // Return with genres included
        const fullTrack = await db.track.findUnique({
            where: { id: track.id },
            include: { genres: { include: { genre: true } } }
        });

        res.json(fullTrack);
    } catch (e: any) {
        // Handle multer file-size errors with a friendly message
        if (e.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File is too large. Maximum size is 300MB. For WAV files, consider exporting at 16-bit/44.1kHz.' });
        }
        logger.error('Failed to upload track', e);
        res.status(500).json({ error: e.message || 'Failed to upload track' });
    }
});

// Update track info
app.patch('/api/musician/tracks/:trackId', async (req: any, res) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { trackId } = req.params;
        const { title, description, isPublic, artist, album, year, bpm, key, genreIds, allowAudioDownload, allowProjectDownload } = req.body;

        // Ownership check
        const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
        if (!track || track.profile.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // If track is being made private, clear it as the featured track on the profile
        if (isPublic === false || isPublic === 'false') {
            await db.musicianProfile.updateMany({
                where: { featuredTrackId: trackId },
                data: { featuredTrackId: null }
            });
        }

        const updated = await db.track.update({
            where: { id: trackId },
            data: { 
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(isPublic !== undefined && { isPublic }),
                ...(artist !== undefined && { artist }),
                ...(album !== undefined && { album }),
                ...(year !== undefined && { year: year ? parseInt(year) : null }),
                ...(bpm !== undefined && { bpm: bpm ? parseInt(bpm) : null }),
                ...(key !== undefined && { key: key || null }),
                ...(allowAudioDownload !== undefined && { allowAudioDownload: allowAudioDownload === 'true' || allowAudioDownload === true }),
                ...(allowProjectDownload !== undefined && { allowProjectDownload: allowProjectDownload === 'true' || allowProjectDownload === true }),
            }
        });

        // Sync genre tags if provided
        if (genreIds && Array.isArray(genreIds)) {
            await db.trackGenre.deleteMany({ where: { trackId } });
            if (genreIds.length > 0) {
                await db.trackGenre.createMany({
                    data: genreIds.map((gid: string) => ({ trackId, genreId: gid })),
                    skipDuplicates: true
                });
            }
        }

        const fullTrack = await db.track.findUnique({
            where: { id: trackId },
            include: { genres: { include: { genre: true } } }
        });
        res.json(fullTrack);
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

// Delete physical files (from R2 or local storage)
          await deleteFromStorage(track.url);
          await deleteFromStorage(track.coverUrl);
          await deleteFromStorage((track as any).projectFileUrl);
          await deleteFromStorage((track as any).projectZipUrl);

        await db.musicianProfile.updateMany({
            where: { featuredTrackId: trackId },
            data: { featuredTrackId: null }
        });
        await db.track.delete({ where: { id: trackId } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Edit track with file re-uploads (audio, artwork, project)
app.put('/api/musician/tracks/:trackId', upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'artwork', maxCount: 1 },
    { name: 'project', maxCount: 1 }
]), async (req: any, res) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { trackId } = req.params;

        // Ownership check
        const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
        if (!track || track.profile.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const audioFile = files['audio']?.[0];
        const artworkFile = files['artwork']?.[0];
        const projectFile = files['project']?.[0];

        const updateData: any = {};

        // Text field updates
        const { title, description, artist, album, year, bpm, key: musicKey, genreIds, allowAudioDownload, allowProjectDownload } = req.body;
        logger.info(`[PUT track ${trackId}] allowAudioDownload=${JSON.stringify(allowAudioDownload)} allowProjectDownload=${JSON.stringify(allowProjectDownload)}`);
        if (title !== undefined) {
            updateData.title = title;
            updateData.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }
        if (description !== undefined) updateData.description = description || null;
        if (artist !== undefined) updateData.artist = artist || null;
        if (album !== undefined) updateData.album = album || null;
        if (year !== undefined) updateData.year = year ? parseInt(year) : null;
        if (bpm !== undefined) updateData.bpm = bpm ? parseInt(bpm) : null;
        if (musicKey !== undefined) updateData.key = musicKey || null;
        if (allowAudioDownload !== undefined) updateData.allowAudioDownload = allowAudioDownload === 'true' || allowAudioDownload === true;
        if (allowProjectDownload !== undefined) updateData.allowProjectDownload = allowProjectDownload === 'true' || allowProjectDownload === true;
        logger.info(`[PUT track ${trackId}] updateData.allowAudioDownload=${updateData.allowAudioDownload}`);

        // Audio file replacement
        if (audioFile) {
            // Extract duration before conversion (metadata survives in most formats)
            try {
                const parsed = await mm.parseFile(audioFile.path);
                updateData.duration = Math.round(parsed.format.duration || 0);
            } catch (err) {
                logger.warn(`Failed to parse metadata for replaced audio: ${err}`);
            }
            // Convert to 320kbps MP3
            const finalAudioPath = await MediaConverter.convertAudio(audioFile.path);
            // Delete old audio from R2 or local
            await deleteFromStorage(track.url);
            // Upload new audio to R2 or store locally
            const r2AudioKey = `tracks/${trackId}/audio/${path.basename(finalAudioPath)}`;
            updateData.url = await uploadToR2OrLocal(finalAudioPath, r2AudioKey, 'audio/mpeg', `/uploads/tracks/${path.basename(finalAudioPath)}`);
        }

        // Artwork replacement
        if (artworkFile) {
            // Convert to WebP
            const finalArtworkPath = await MediaConverter.optimizeImage(artworkFile.path);
            // Delete old artwork from R2 or local
            await deleteFromStorage(track.coverUrl);
            // Upload new artwork to R2 or store locally
            const r2ArtworkKey = `tracks/${trackId}/artwork/${path.basename(finalArtworkPath)}`;
            updateData.coverUrl = await uploadToR2OrLocal(finalArtworkPath, r2ArtworkKey, 'image/webp', `/uploads/artwork/${path.basename(finalArtworkPath)}`);
        }

        // Project file replacement — re-parse FLP or re-process ZIP
        if (projectFile) {
            const isZip = projectFile.originalname.endsWith('.zip');

            // Delete old project files from R2 or local
            await deleteFromStorage(track.projectFileUrl);
            if ((track as any).projectZipUrl) await deleteFromStorage((track as any).projectZipUrl);

            if (!isZip) {
                updateData.projectZipUrl = null;
                try {
                    const flpBuffer = fs.readFileSync(projectFile.path);
                    const arrangement = FLPParser.parse(flpBuffer);
                    const finalBpm = (bpm ? parseInt(bpm) : null) || updateData.bpm || track.bpm;
                    if (finalBpm) (arrangement as any).bpm = finalBpm;
                    updateData.arrangement = arrangement;
                    logger.info(`Re-parsed FLP for track edit: ${track.title} — arrangement BPM set to ${finalBpm}`);
                } catch (e) {
                    logger.warn(`Failed to parse replaced FLP file: ${e}`);
                }
                // Upload FLP to R2 or store locally
                const r2ProjectKey = `tracks/${trackId}/project/${path.basename(projectFile.path)}`;
                updateData.projectFileUrl = await uploadToR2OrLocal(projectFile.path, r2ProjectKey, 'application/octet-stream', `/uploads/projects/${path.basename(projectFile.path)}`);
            } else {
                // ZIP bundle replacement — process first (reads local file), then upload to R2
                updateData.projectFileSizeBytes = projectFile.size;
                try {
                    const { arrangement: enrichedArr, sampleCount } = await ProjectZipProcessor.process(
                        projectFile.path,
                        trackId,
                        db,
                    );
                    const finalBpm = (bpm ? parseInt(bpm) : null) || updateData.bpm || track.bpm;
                    if (finalBpm) (enrichedArr as any).bpm = finalBpm;
                    updateData.arrangement = enrichedArr;
                    logger.info(`ZIP re-processed: ${sampleCount} samples for track ${trackId}`);
                } catch (zipErr: any) {
                    logger.warn(`ZIP re-processing failed for track ${trackId}: ${zipErr.message}`);
                }
                // Upload ZIP to R2 after processing (ProjectZipProcessor needs the local file first)
                const r2ZipKey = `tracks/${trackId}/project/${path.basename(projectFile.path)}`;
                updateData.projectZipUrl = await uploadToR2OrLocal(projectFile.path, r2ZipKey, 'application/zip', `/uploads/projects/${path.basename(projectFile.path)}`);
            }
        }

        // If BPM changed but no new FLP, update arrangement BPM too
        if (bpm && !projectFile && track.arrangement) {
            const arr = { ...(track.arrangement as any), bpm: parseInt(bpm) };
            updateData.arrangement = arr;
        }

        await db.track.update({ where: { id: trackId }, data: updateData });

        // Sync genre tags if provided
        if (genreIds) {
            const ids = typeof genreIds === 'string' ? JSON.parse(genreIds) : genreIds;
            await db.trackGenre.deleteMany({ where: { trackId } });
            if (Array.isArray(ids) && ids.length > 0) {
                await db.trackGenre.createMany({
                    data: ids.map((gid: string) => ({ trackId, genreId: gid })),
                    skipDuplicates: true
                });
            }
        }

        const fullTrack = await db.track.findUnique({
            where: { id: trackId },
            include: { profile: true, genres: { include: { genre: true } } }
        });
        res.json(fullTrack);
    } catch (e: any) {
        logger.error('Failed to update track', e);
        res.status(500).json({ error: e.message });
    }
});

// Admin: Edit any user's track (same as PUT but bypasses ownership)
app.put('/api/admin/tracks/:trackId', requireAdmin, upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'artwork', maxCount: 1 },
    { name: 'project', maxCount: 1 }
]), async (req: any, res) => {
    try {
        const userId = req.session.user.id;

        const { trackId } = req.params;
        const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
        if (!track) return res.status(404).json({ error: 'Track not found' });

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const audioFile = files['audio']?.[0];
        const artworkFile = files['artwork']?.[0];
        const projectFile = files['project']?.[0];

        const updateData: any = {};

        const { title, description, artist, album, year, bpm, key: musicKey, genreIds } = req.body;
        if (title !== undefined) {
            updateData.title = title;
            updateData.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }
        if (description !== undefined) updateData.description = description || null;
        if (artist !== undefined) updateData.artist = artist || null;
        if (album !== undefined) updateData.album = album || null;
        if (year !== undefined) updateData.year = year ? parseInt(year) : null;
        if (bpm !== undefined) updateData.bpm = bpm ? parseInt(bpm) : null;
        if (musicKey !== undefined) updateData.key = musicKey || null;

        if (audioFile) {
            // Parse metadata before upload (metadata-metadata file may be deleted after R2 upload)
            try {
                const parsed = await mm.parseFile(audioFile.path);
                updateData.duration = Math.round(parsed.format.duration || 0);
            } catch (err) {
                logger.warn(`Failed to parse metadata for replaced audio: ${err}`);
            }
            // Delete old audio from R2 or local
            await deleteFromStorage(track.url);
            // Upload new audio to R2 or store locally
            const r2AudioKey = `tracks/${trackId}/audio/${path.basename(audioFile.path)}`;
            updateData.url = await uploadToR2OrLocal(audioFile.path, r2AudioKey, 'audio/mpeg', `/uploads/tracks/${path.basename(audioFile.path)}`);
        }

        if (artworkFile) {
            // Delete old artwork from R2 or local
            await deleteFromStorage(track.coverUrl);
            // Upload new artwork to R2 or store locally
            const r2ArtworkKey = `tracks/${trackId}/artwork/${path.basename(artworkFile.path)}`;
            updateData.coverUrl = await uploadToR2OrLocal(artworkFile.path, r2ArtworkKey, 'image/webp', `/uploads/artwork/${path.basename(artworkFile.path)}`);
        }

        if (projectFile) {
            // Parse FLP before upload (file may be deleted after R2 upload)
            try {
                const flpBuffer = fs.readFileSync(projectFile.path);
                const arrangement = FLPParser.parse(flpBuffer);
                const finalBpm = (bpm ? parseInt(bpm) : null) || updateData.bpm || track.bpm;
                if (finalBpm) (arrangement as any).bpm = finalBpm;
                updateData.arrangement = arrangement;
            } catch (e) {
                logger.warn(`Failed to parse replaced FLP file: ${e}`);
            }
            // Delete old project from R2 or local
            await deleteFromStorage(track.projectFileUrl);
            // Upload new project to R2 or store locally
            const r2ProjectKey = `tracks/${trackId}/project/${path.basename(projectFile.path)}`;
            updateData.projectFileUrl = await uploadToR2OrLocal(projectFile.path, r2ProjectKey, 'application/octet-stream', `/uploads/projects/${path.basename(projectFile.path)}`);
        }

        if (bpm && !projectFile && track.arrangement) {
            const arr = { ...(track.arrangement as any), bpm: parseInt(bpm) };
            updateData.arrangement = arr;
        }

        await db.track.update({ where: { id: trackId }, data: updateData });

        if (genreIds) {
            const ids = typeof genreIds === 'string' ? JSON.parse(genreIds) : genreIds;
            await db.trackGenre.deleteMany({ where: { trackId } });
            if (Array.isArray(ids) && ids.length > 0) {
                await db.trackGenre.createMany({
                    data: ids.map((gid: string) => ({ trackId, genreId: gid })),
                    skipDuplicates: true
                });
            }
        }

        const fullTrack = await db.track.findUnique({
            where: { id: trackId },
            include: { profile: true, genres: { include: { genre: true } } }
        });
        
        logger.info(`Admin edited track: ${track.title} (ID: ${trackId}) by admin ${userId}`);
        res.json(fullTrack);
    } catch (e: any) {
        logger.error('Admin track edit failed', e);
        res.status(500).json({ error: e.message });
    }
});

// Admin: List all tracks (for admin track management)
app.get('/api/admin/tracks', requireAdmin, async (req: any, res) => {
    try {
        const search = req.query.search as string || '';
        const tracks = await db.track.findMany({
            where: search ? {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { artist: { contains: search, mode: 'insensitive' } },
                    { profile: { username: { contains: search, mode: 'insensitive' } } },
                    { profile: { displayName: { contains: search, mode: 'insensitive' } } },
                ]
            } : {},
            include: { profile: true, genres: { include: { genre: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // Track permission backfill
        tracks.forEach((t: any) => {
            if (t.allowAudioDownload === undefined) t.allowAudioDownload = true;
            if (t.allowProjectDownload === undefined) t.allowProjectDownload = true;
        });

        res.json(tracks);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Leaderboard: Top Tracks
app.get('/api/musician/leaderboards/tracks', async (req, res) => {
    try {
        const topTracks = await audioService.getTrackLeaderboard(12);
        
        // Track permission backfill
        topTracks.forEach((t: any) => {
            if (t.allowAudioDownload === undefined) t.allowAudioDownload = true;
            if (t.allowProjectDownload === undefined) t.allowProjectDownload = true;
        });

        res.json(topTracks);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Discovery: Filtered Tracks (Genre/Search/Sort)
app.get('/api/discovery/tracks', async (req, res) => {
    try {
        const { genre, search, sort = 'newest', limit = 24 } = req.query;
        
        const where: any = { isPublic: true };
        
        if (genre) {
            // Get all sub-genres of this parent genre to include them in results
            const parentGenre = await db.genre.findFirst({
                where: { 
                    OR: [
                        { slug: { equals: genre as string, mode: 'insensitive' } },
                        { name: { equals: genre as string, mode: 'insensitive' } }
                    ]
                },
                include: { children: true }
            });

            const genreIdsToMatch = parentGenre 
                ? [parentGenre.id, ...parentGenre.children.map(c => c.id)] 
                : [];

            if (genreIdsToMatch.length > 0) {
                where.genres = {
                    some: {
                        genreId: { in: genreIdsToMatch }
                    }
                };
            } else {
                // Fallback for when slug lookup fails, keep existing name-based matching
                where.genres = {
                    some: {
                        genre: {
                            OR: [
                                { slug: { equals: genre as string, mode: 'insensitive' } },
                                { name: { equals: genre as string, mode: 'insensitive' } },
                                { parent: { slug: { equals: genre as string, mode: 'insensitive' } } },
                                { parent: { name: { equals: genre as string, mode: 'insensitive' } } }
                            ]
                        }
                    }
                };
            }
        }

        if (search) {
            where.OR = [
                { title: { contains: search as string, mode: 'insensitive' } },
                { artist: { contains: search as string, mode: 'insensitive' } },
                { profile: { username: { contains: search as string, mode: 'insensitive' } } },
                { profile: { displayName: { contains: search as string, mode: 'insensitive' } } },
            ];
        }

        let orderBy: any = { createdAt: 'desc' };
        if (sort === 'plays') orderBy = { playCount: 'desc' };
        if (sort === 'oldest') orderBy = { createdAt: 'asc' };
        if (sort === 'alphabetical') orderBy = { title: 'asc' };

        const tracks = await db.track.findMany({
            where,
            orderBy,
            include: {
                profile: true,
                genres: { include: { genre: true } }
            },
            take: Number(limit)
        });

        // Ensure new permission fields exist even if migration hasn't run fully or records are old
        // Filter out suspended/hidden tracks and profiles (application-level so it's safe before migration)
        const activeTracks = tracks.filter((t: any) => (!t.status || t.status === 'active') && (!t.profile?.status || t.profile.status === 'active'));
        activeTracks.forEach((t: any) => {
            if (t.allowAudioDownload === undefined) t.allowAudioDownload = true;
            if (t.allowProjectDownload === undefined) t.allowProjectDownload = true;
        });

        let genreFound = null;
        if (genre) {
            genreFound = await db.genre.findFirst({
                where: { 
                    OR: [
                        { slug: { equals: genre as string, mode: 'insensitive' } },
                        { name: { equals: genre as string, mode: 'insensitive' } }
                    ]
                },
                include: {
                    children: {
                        include: {
                            _count: { select: { tracks: true } }
                        }
                    }
                }
            });
        }

        res.json({
            tracks: activeTracks,
            genre: genreFound
        });
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
      const { search, genre, sort = 'newest', limit = 50 } = req.query;
      
      const where: any = {};
      
      if (search) {
          where.OR = [
              { username: { contains: search as string, mode: 'insensitive' } },
              { displayName: { contains: search as string, mode: 'insensitive' } },
              { bio: { contains: search as string, mode: 'insensitive' } },
              { hardware: { hasSome: [search as string] } }
          ];
      }
      
      if (genre) {
          where.genres = {
              some: {
                  genre: { 
                      OR: [
                          { name: { equals: genre as string, mode: 'insensitive' } },
                          { slug: { equals: genre as string, mode: 'insensitive' } }
                      ]
                  }
              }
          };
      }

      let orderBy: any = { createdAt: 'desc' };
      if (sort === 'popular') orderBy = { playCount: 'desc' }; // Note: Schema might need total play count field or aggregation
      if (sort === 'oldest') orderBy = { createdAt: 'asc' };

      const profiles = await db.musicianProfile.findMany({
          where,
          include: {
              genres: { include: { genre: true } },
              tracks: { 
                  where: { isPublic: true },
                  take: 1,
                  orderBy: { playCount: 'desc' }
              },
              _count: {
                  select: { tracks: true }
              }
          },
          orderBy,
          take: Number(limit)
      });

      // Sort alphabetically by display name (falling back to username) when requested
      if (sort === 'alphabetical') {
          profiles.sort((a: any, b: any) => {
              const nameA = (a.displayName || a.username).toLowerCase();
              const nameB = (b.displayName || b.username).toLowerCase();
              return nameA.localeCompare(nameB);
          });
      }

      // Filter suspended/banned profiles application-side (safe before migration runs)
      const activeProfiles = profiles.filter((p: any) => !p.status || p.status === 'active');

      // Track permission backfill for profile previews
      activeProfiles.forEach((p: any) => {
          if (p.tracks) {
              p.tracks = p.tracks.filter((t: any) => !t.status || t.status === 'active');
              p.tracks.forEach((t: any) => {
                  if (t.allowAudioDownload === undefined) t.allowAudioDownload = true;
                  if (t.allowProjectDownload === undefined) t.allowProjectDownload = true;
              });
          }
      });

      res.json(activeProfiles);
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
            // Try fetching by username (the :userId param might be a username)
            const byUsername = (await db.musicianProfile.findFirst({
                where: { username: { equals: userId, mode: 'insensitive' } },
                include: { genres: true, tracks: { include: { plays: true, genres: { include: { genre: true } } } } }
            })) as any;
            if (byUsername) {
                if (byUsername.status && byUsername.status !== 'active') {
                    return res.status(404).json({ error: 'Profile not found' });
                }
                if (byUsername.tracks) {
                    byUsername.tracks = byUsername.tracks.filter((t: any) => t.status === 'active' || !t.status);
                    byUsername.tracks.forEach((t: any) => {
                        if (t.allowAudioDownload === undefined) t.allowAudioDownload = true;
                        if (t.allowProjectDownload === undefined) t.allowProjectDownload = true;
                    });
                }
                return res.json(byUsername);
            }
            return res.status(404).json({ error: 'Profile not found' });
        }
        
        const profileData = profile as any;
        if (profileData.status && profileData.status !== 'active') {
            return res.status(404).json({ error: 'Profile not found' });
        }
        if (profileData && profileData.tracks) {
            profileData.tracks = profileData.tracks.filter((t: any) => t.status === 'active' || !t.status);
            profileData.tracks.forEach((t: any) => {
                if (t.allowAudioDownload === undefined) t.allowAudioDownload = true;
                if (t.allowProjectDownload === undefined) t.allowProjectDownload = true;
            });
        }
        
        res.json(profileData);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/musician/tracks/:username/:trackSlug', async (req, res) => {
    try {
        const { username, trackSlug } = req.params;
        
        const profile = await db.musicianProfile.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } }
        });

        if (!profile) return res.status(404).json({ error: 'Artist not found' });

        const track = (await db.track.findFirst({
            where: { 
                profileId: profile.id,
                slug: { equals: trackSlug, mode: 'insensitive' }
            },
            include: { 
                profile: true,
                genres: { include: { genre: true } },
                plays: true,
                samples: true
            }
        })) as any;

        if (!track) {
            // Fallback: try by ID if slug doesn't match
            const byId = (await db.track.findFirst({
                where: { profileId: profile.id, id: trackSlug },
                include: { profile: true, genres: { include: { genre: true } }, plays: true, samples: true }
            })) as any;
            if (byId) {
                if (byId.allowAudioDownload === undefined) byId.allowAudioDownload = true;
                if (byId.allowProjectDownload === undefined) byId.allowProjectDownload = true;
                return res.json(byId);
            }
            return res.status(404).json({ error: 'Track not found' });
        }

        if (track.allowAudioDownload === undefined) track.allowAudioDownload = true;
        if (track.allowProjectDownload === undefined) track.allowProjectDownload = true;

        res.json(track);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Update Profile (Auth should be handled by a middleware, but for now we follow context guild patterns)
app.post('/api/musician/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const data = req.body;
        
        // Validate displayName against word filters if provided
        if (data.displayName && typeof data.displayName === 'string' && data.displayName.trim()) {
            const wordGroups = await db.wordGroup.findMany({
                where: { enabled: true },
                include: { words: true }
            });
            const lowerName = data.displayName.toLowerCase();
            for (const group of wordGroups) {
                for (const fw of group.words) {
                    const pattern = new RegExp(`\\b${fw.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?\\b`, 'i');
                    if (pattern.test(lowerName)) {
                        return res.status(400).json({ error: 'Your artist name contains a restricted word. Please choose a different name.' });
                    }
                }
            }
        }

        // Ensure username is present (Required by schema)
        const user = await resolveUser(userId);
        if (!data.username) {
            data.username = user ? user.username : 'Unknown Musician';
        }
        
        // Auto-update avatar from Discord ONLY if no custom avatar is provided
        if (user && user.avatar && !data.avatar) {
            data.avatar = user.avatar;
        }

        // Map frontend social fields to ProfileService format
        const socials = [
            { platform: 'spotify', url: data.spotifyUrl },
            { platform: 'soundcloud', url: data.soundcloudUrl },
            { platform: 'youtube', url: data.youtubeUrl },
            { platform: 'instagram', url: data.instagramUrl },
            { platform: 'discord', url: data.discordUrl }
        ].filter(s => !!s.url);

        // Basic check for common structure
        if (!data.genres) data.genres = [];
        
        // Extract IDs if passed as objects from frontend
        const genreIds = data.genres.map((g: any) => typeof g === 'string' ? g : g.id).filter(Boolean);

        const updated = await profileService.updateProfile(userId, {
            ...data,
            socials,
            genreIds,
            featuredTrackId: data.featuredTrackId
        });

        // Log profile creation/update
        await logAction('GLOBAL', 'profile_updated', userId, updated.id, { username: updated.username });

        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Genre Library for Picker
app.get('/api/musician/genres', async (req, res) => {
    try {
        const genres = await db.genre.findMany({
            include: {
                _count: {
                    select: {
                        profiles: true,
                        tracks: true
                    }
                },
                children: true
            },
            orderBy: { name: 'asc' }
        });
        
        // Debug logging for the issue reported
        logger.info(`[API] Fetched ${genres.length} genres. First genre track count: ${genres[0]?._count?.tracks || 0}`);
        
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

// ===== Discovery Settings (Admin) =====

// Get discovery settings
app.get('/api/discovery/settings', async (req, res) => {
    try {
        let settings = await db.discoverySettings.findUnique({ where: { id: 'singleton' } });
        if (!settings) {
            settings = await db.discoverySettings.create({ data: { id: 'singleton' } });
        }
        // If there's a featured track, include full track + profile info
        let featuredTrack = null;
        if (settings.featuredTrackId) {
            featuredTrack = await db.track.findUnique({
                where: { id: settings.featuredTrackId },
                include: { profile: true }
            }) as any;

            if (featuredTrack) {
                if (featuredTrack.allowAudioDownload === undefined) featuredTrack.allowAudioDownload = true;
                if (featuredTrack.allowProjectDownload === undefined) featuredTrack.allowProjectDownload = true;
            }
        }
        res.json({ ...settings, featuredTrack });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Update discovery settings (admin only)
app.post('/api/discovery/settings', requireAdmin, async (req, res) => {
    try {
        const { featuredTrackId, featuredLabel } = req.body;

        const settings = await db.discoverySettings.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', featuredTrackId, featuredLabel },
            update: { featuredTrackId, featuredLabel }
        });
        res.json(settings);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Search all tracks (for admin featured track picker)
app.get('/api/discovery/tracks/search', async (req, res) => {
    try {
        const search = req.query.search as string;
        const tracks = await db.track.findMany({
            where: {
                isPublic: true,
                ...(search ? {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' as const } },
                        { artist: { contains: search, mode: 'insensitive' as const } },
                        { profile: { displayName: { contains: search, mode: 'insensitive' as const } } },
                        { profile: { username: { contains: search, mode: 'insensitive' as const } } }
                    ]
                } : {})
            },
            include: { profile: true },
            orderBy: { playCount: 'desc' },
            take: 20
        });
        res.json(tracks);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Debug: inspect arrangement data for a specific track (Admin only)
app.get('/api/admin/debug-arrangement/:trackId', requireAdmin, async (req, res) => {
    try {
        const track = await db.track.findUnique({ where: { id: req.params.trackId } });
        if (!track) return res.status(404).json({ error: 'Track not found' });

        const arrangement = track.arrangement as any;
        const result: any = {
            trackId: track.id,
            title: track.title,
            projectFileUrl: track.projectFileUrl,
            hasArrangement: !!arrangement,
            arrangementKeys: arrangement ? Object.keys(arrangement) : [],
            markers: arrangement?.markers ?? 'NO_MARKERS_KEY',
            markerCount: arrangement?.markers?.length ?? 0,
            trackCount: arrangement?.tracks?.length ?? 0,
            bpm: arrangement?.bpm ?? null,
            sampleTrack: arrangement?.tracks?.[0] ?? null,
        };

        // Check if FLP file exists on disk
        if (track.projectFileUrl) {
            const relativePath = track.projectFileUrl.startsWith('/') ? track.projectFileUrl.substring(1) : track.projectFileUrl;
            const absolutePath = path.join(PROJECT_ROOT, 'public', relativePath);
            result.flpFileExists = fs.existsSync(absolutePath);
            result.flpAbsolutePath = absolutePath;

            // Re-parse live and compare
            if (result.flpFileExists) {
                try {
                    const flpBuffer = fs.readFileSync(absolutePath);
                    const freshParse = FLPParser.parse(flpBuffer) as any;
                    result.freshParseMarkers = freshParse.markers;
                    result.freshParseMarkerCount = freshParse.markers?.length ?? 0;
                    result.freshParseTrackCount = freshParse.tracks?.length ?? 0;
                    result.freshParseBpm = freshParse.bpm;
                    // Show first track's group info
                    result.freshParseSampleTrack = freshParse.tracks?.[0] ?? null;
                } catch (e: any) {
                    result.freshParseError = e.message;
                }
            }
        } else {
            result.flpFileExists = false;
            result.note = 'No projectFileUrl — track has no FLP file';
        }

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Debug: list all tracks with their arrangement summary (Admin only)
app.get('/api/admin/debug-tracks-summary', requireAdmin, async (req, res) => {
    try {
        const tracks = await db.track.findMany({
            select: { id: true, title: true, projectFileUrl: true, arrangement: true },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        const summary = tracks.map(t => {
            const arr = t.arrangement as any;
            return {
                id: t.id,
                title: t.title,
                hasFlp: !!t.projectFileUrl,
                hasArrangement: !!arr,
                markers: arr?.markers?.length ?? 0,
                tracks: arr?.tracks?.length ?? 0,
                bpm: arr?.bpm ?? null,
                groupedTracks: arr?.tracks?.filter((tr: any) => (tr.group ?? 0) > 0).length ?? 0,
            };
        });

        res.json(summary);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Migrate existing local uploads to R2 (one-time admin operation)
app.post('/api/admin/migrate-uploads-to-r2', requireAdmin, async (req, res) => {
    if (!R2Storage.isConfigured()) {
        return res.status(503).json({ error: 'R2 is not configured on this server.' });
    }

    const results = {
        tracks: { total: 0, audio: 0, artwork: 0, projectFile: 0, projectZip: 0, errors: [] as string[] }
    };

    const tracks = await db.track.findMany({
        select: { id: true, title: true, url: true, coverUrl: true, projectFileUrl: true, projectZipUrl: true }
    });
    results.tracks.total = tracks.length;

    for (const track of tracks) {
        const updates: any = {};

        const tryUpload = async (
            field: keyof typeof updates,
            url: string | null | undefined,
            dir: string,
            contentType: string,
            counter: keyof typeof results.tracks
        ) => {
            if (!url || !url.startsWith('/uploads/')) return;
            const localPath = path.join(PROJECT_ROOT, 'public', url);
            if (!fs.existsSync(localPath)) {
                results.tracks.errors.push(`[${track.title}] Missing file: ${localPath}`);
                return;
            }
            try {
                const buffer = fs.readFileSync(localPath);
                const filename = path.basename(url);
                const r2Key = `tracks/${track.id}/${dir}/${filename}`;
                const cdnUrl = await R2Storage.uploadBuffer(r2Key, buffer, contentType);
                updates[field] = cdnUrl;
                (results.tracks[counter] as number)++;
            } catch (err: any) {
                results.tracks.errors.push(`[${track.title}] Failed ${String(field)}: ${err.message}`);
            }
        };

        await tryUpload('url',            track.url,            'audio',   'audio/mpeg',             'audio');
        await tryUpload('coverUrl',        track.coverUrl,       'artwork', 'image/webp',              'artwork');
        await tryUpload('projectFileUrl',  track.projectFileUrl, 'project', 'application/octet-stream','projectFile');
        await tryUpload('projectZipUrl',   track.projectZipUrl,  'project', 'application/zip',         'projectZip');

        if (Object.keys(updates).length > 0) {
            await db.track.update({ where: { id: track.id }, data: updates });
        }
    }

    logger.info(`R2 migration complete: ${JSON.stringify(results.tracks)}`);
    res.json(results);
});

// Re-process all FLP files (Admin operation)
app.post('/api/admin/reprocess-flps', requireAdmin, async (req, res) => {
    try {
        // Find all tracks that have a projectFileUrl
        const tracksWithFlps = await db.track.findMany({
            where: { projectFileUrl: { not: null } }
        });

        const results = {
            total: tracksWithFlps.length,
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const track of tracksWithFlps) {
            try {
                // projectFileUrl is like /uploads/projects/project-123.flp
                // The actual file is stored in public/uploads/projects/project-123.flp
                // We need to resolve this correctly relative to PROJECT_ROOT
                const relativePath = track.projectFileUrl!.startsWith('/') ? track.projectFileUrl!.substring(1) : track.projectFileUrl!;
                const absolutePath = path.join(PROJECT_ROOT, 'public', relativePath);

                logger.info(`Checking FLP at: ${absolutePath}`);

                if (fs.existsSync(absolutePath)) {
                    const flpBuffer = fs.readFileSync(absolutePath);
                    const arrangement = FLPParser.parse(flpBuffer);
                    
                    // If the track already has a user-entered BPM, use that for the arrangement display
                    // The FLP parser's BPM detection is unreliable (FL often stores default 140)
                    if (track.bpm && track.bpm > 0) {
                        (arrangement as any).bpm = track.bpm;
                    }

                    logger.info(`Track: ${track.title} | User BPM: ${track.bpm} | Parser BPM: ${(arrangement as any).bpm} | Final arrangement BPM: ${(arrangement as any).bpm}`);

                    await db.track.update({
                        where: { id: track.id },
                        data: { arrangement: arrangement as any }
                    });
                    results.success++;
                } else {
                    results.failed++;
                    results.errors.push(`File not found for track: ${track.title} (Expected at: ${absolutePath})`);
                }
            } catch (err: any) {
                results.failed++;
                results.errors.push(`Error processing ${track.title}: ${err.message}`);
            }
        }

        res.json(results);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ===== Artist Name Validation (word filter check) =====
app.post('/api/musician/validate-name', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Get all enabled word filter groups across all guilds
        const wordGroups = await db.wordGroup.findMany({
            where: { enabled: true },
            include: { words: true }
        });

        const lowerName = name.toLowerCase();
        for (const group of wordGroups) {
            for (const fw of group.words) {
                // Match the word with optional plural forms, same as the WordFilterPlugin
                const pattern = new RegExp(`\\b${fw.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?\\b`, 'i');
                if (pattern.test(lowerName)) {
                    return res.json({ valid: false, reason: 'This name contains a restricted word.' });
                }
            }
        }

        res.json({ valid: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ===== Genres used in discovery (from actual user profiles) =====
app.get('/api/discovery/genres', async (req, res) => {
    try {
        // Get genres that are actually used by at least one profile, sorted by popularity
        const usedGenres = await db.genre.findMany({
            where: {
                profiles: { some: {} }
            },
            include: {
                _count: { select: { profiles: true } }
            },
            orderBy: { profiles: { _count: 'desc' } }
        });

        // If fewer than 5 used genres, backfill with top-level genres (parentId == null)
        if (usedGenres.length < 5) {
            const usedIds = new Set(usedGenres.map((g: any) => g.id));
            const topLevel = await db.genre.findMany({
                where: { parentId: null },
                include: { _count: { select: { profiles: true } } },
                orderBy: { name: 'asc' }
            });
            const extras = topLevel.filter((g: any) => !usedIds.has(g.id));
            const merged = [...usedGenres, ...extras].slice(0, 10);
            return res.json(merged);
        }

        res.json(usedGenres);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Avatar upload endpoint
app.post('/api/musician/profile/:userId/avatar', upload.single('avatar'), async (req: any, res) => {
    try {
        const { userId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'Avatar file is required' });
        }

        // Convert to WebP before saving
        const finalAvatarPath = await MediaConverter.optimizeImage(file.path);

        // Update profile with the new avatar URL
        const profile = await db.musicianProfile.findFirst({ where: { userId } });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Delete old avatar from R2 or local, then upload new one
        await deleteFromStorage(profile.avatar);
        const r2AvatarKey = `profiles/${profile.id}/avatar/${path.basename(finalAvatarPath)}`;
        const avatarUrl = await uploadToR2OrLocal(finalAvatarPath, r2AvatarKey, 'image/webp', `/uploads/avatars/${path.basename(finalAvatarPath)}`);

        const updated = await db.musicianProfile.update({
            where: { id: profile.id },
            data: { avatar: avatarUrl }
        });

        // Log avatar upload
        await logAction('GLOBAL', 'avatar_uploaded', userId, profile.id, { url: avatarUrl });

        res.json({ avatar: updated.avatar });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Admin: Search Profiles
app.get('/api/admin/musician/profiles/search', async (req: any, res) => {
    try {
        const { search } = req.query;
        if (!search) return res.json([]);
        
        const profiles = await db.musicianProfile.findMany({
            where: {
                OR: [
                    { username: { contains: search, mode: 'insensitive' } },
                    { displayName: { contains: search, mode: 'insensitive' } },
                    { userId: { contains: search } }
                ]
            },
            take: 10,
            include: { _count: { select: { tracks: true } } }
        });
        res.json(profiles);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Admin: Wipe Profile
app.post('/api/admin/musician/profile/:id/wipe', requireAdmin, async (req: any, res) => {
    try {
        const { id } = req.params;
        const executorId = req.session.user.id;

        const profile = await db.musicianProfile.findUnique({
            where: { id },
            include: { tracks: true }
        });

        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        // 1. Delete all associated files from R2 or local storage
        if (profile.avatar) await deleteFromStorage(profile.avatar).catch((err: any) =>
            logger.error(`Failed to delete avatar during profile wipe: ${profile.avatar}`, err));
        for (const track of profile.tracks) {
            await deleteFromStorage(track.url).catch((err: any) =>
                logger.error(`Failed to delete track audio during profile wipe: ${track.url}`, err));
            if (track.coverUrl) await deleteFromStorage(track.coverUrl).catch((err: any) =>
                logger.error(`Failed to delete track artwork during profile wipe: ${track.coverUrl}`, err));
            if ((track as any).projectFileUrl) await deleteFromStorage((track as any).projectFileUrl).catch((err: any) =>
                logger.error(`Failed to delete track project during profile wipe`, err));
            if ((track as any).projectZipUrl) await deleteFromStorage((track as any).projectZipUrl).catch((err: any) =>
                logger.error(`Failed to delete track ZIP during profile wipe`, err));
        }

        // 2. Delete from DB (Tracks cascade delete, but we need to stay safe)
        await db.musicianProfile.delete({ where: { id } });

        // 4. Log the wipe
        await logAction('GLOBAL', 'profile_wiped', executorId, profile.userId, { 
            profileName: profile.username,
            trackCount: profile.tracks.length 
        });

        res.json({ success: true, message: `Profile and ${profile.tracks.length} tracks deleted.` });
    } catch (e: any) {
        logger.error('Failed to wipe profile', e);
        res.status(500).json({ error: e.message });
    }
});

// Admin: Set Profile Status (suspend/ban/reinstate)
app.patch('/api/admin/musician/profiles/:id/status', requireAdmin, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;
        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be: active, suspended, or banned' });
        }
        const profile = await db.musicianProfile.update({
            where: { id },
            data: { status, statusReason: reason || null }
        });
        await logAction('GLOBAL', 'profile_status_changed', req.session.user.id, profile.userId, {
            status, reason, username: profile.username
        });
        res.json({ success: true, profile });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Admin: Set Track Status (suspend/reinstate/soft-delete)
app.patch('/api/admin/tracks/:trackId/status', requireAdmin, async (req: any, res) => {
    try {
        const { trackId } = req.params;
        const { status, reason } = req.body;
        if (!['active', 'suspended', 'deleted'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be: active, suspended, or deleted' });
        }
        const track = await db.track.update({
            where: { id: trackId },
            data: { status, statusReason: reason || null }
        });
        await logAction('GLOBAL', 'track_status_changed', req.session.user.id, track.profileId, {
            status, reason, title: track.title, trackId
        });
        res.json({ success: true, track });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Admin: List tracks for a profile (including suspended/deleted)
app.get('/api/admin/musician/profiles/:id/tracks', requireAdmin, async (req: any, res) => {
    try {
        const { id } = req.params;
        const tracks = await db.track.findMany({
            where: { profileId: id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tracks);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Stream/Proxy Audio from Discord
app.get('/api/fuji/stream/:attachmentId', async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const msgId = req.query.msgId as string;

        // 1. Fetch metadata from DB
        const sample = await db.sampleMetadata.findUnique({
            where: { attachmentId }
        });

        if (!sample) return res.status(404).send('Sample not found in index');

        // 2. Refresh the Discord URL signature
        // We use the message ID and channel ID from the indexed pack to get the latest attachment URL
        const pack = await db.samplePack.findUnique({ where: { id: sample.packId } });
        if (!pack) return res.status(404).send('Pack not found');

        const discordMsgResp = await discordReq('GET', `/channels/${pack.channelId}/messages/${sample.messageId}`);
        const attachment = discordMsgResp.data.attachments.find((a: any) => a.id === attachmentId);

        if (!attachment || !attachment.url) {
            return res.status(410).send('Discord attachment no longer exists');
        }

        // 3. Set Headers (Important for audio buffering)
        res.setHeader('Content-Type', sample.mimetype);
        if (sample.filesize) res.setHeader('Content-Length', sample.filesize);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=1800'); // Cache for 30 mins
        res.setHeader('Content-Disposition', `inline; filename="${sample.filename}"`);

        // 4. Pipe the Stream
        const streamResp = await axios.get(attachment.url, { responseType: 'stream' });
        streamResp.data.pipe(res);

    } catch (e: any) {
        logger.error(`Fuji Stream Error: ${e.message}`);
        res.status(500).send('Streaming failed');
    }
});

// Download Proxy
app.get('/api/fuji/download/:attachmentId', async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const sample = await db.sampleMetadata.findUnique({
            where: { attachmentId },
            include: { pack: true }
        });

        if (!sample || !sample.pack) return res.status(404).send('Sample not found');

        const discordMsgResp = await discordReq('GET', `/channels/${sample.pack.channelId}/messages/${sample.messageId}`);
        const attachment = discordMsgResp.data.attachments.find((a: any) => a.id === attachmentId);

        if (!attachment || !attachment.url) return res.status(410).send('Expired');

        res.setHeader('Content-Disposition', `attachment; filename="${sample.filename}"`);
        const streamResp = await axios.get(attachment.url, { responseType: 'stream' });
        streamResp.data.pipe(res);
    } catch (e: any) {
        res.status(500).send(e.message);
    }
});

// Search Samples
app.get('/api/fuji/samples/search', async (req: any, res) => {
    try {
        const { q, packId, limit = 100, projectsOnly } = req.query;
        const userId = req.session?.user?.id as string | undefined;
        
        const samples = await db.sampleMetadata.findMany({
            where: {
                ...(packId ? { packId: packId as string } : {}),
                ...(q ? {
                    OR: [
                        { filename: { contains: q as string, mode: 'insensitive' } },
                        { tags: { has: (q as string).toLowerCase() } }
                    ]
                } : {})
            },
            take: Number(limit),
            orderBy: { createdAt: 'desc' },
            include: { 
                pack: true,
                projectFile: true,
                favoritedBy: userId ? { where: { userId } } : false
            }
        });

        const result = samples.map((s: any) => ({
            ...s,
            isLiked: userId ? (s.favoritedBy?.length ?? 0) > 0 : false,
            favoritedBy: undefined
        }));

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Toggle sample like/unlike
app.post('/api/fuji/samples/:id/like', async (req: any, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const { id } = req.params;
        const userId = req.session.user.id as string;

        const existing = await db.userSampleFavorite.findUnique({
            where: { userId_sampleId: { userId, sampleId: id } }
        });

        if (existing) {
            await db.userSampleFavorite.delete({
                where: { userId_sampleId: { userId, sampleId: id } }
            });
            res.json({ liked: false });
        } else {
            await db.userSampleFavorite.create({ data: { userId, sampleId: id } });
            res.json({ liked: true });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Get detailed project data
app.get('/api/projects/:sampleId', async (req, res) => {
    try {
        const { sampleId } = req.params;
        const sample = await db.sampleMetadata.findUnique({
            where: { id: sampleId },
            include: { projectFile: true }
        });

        if (!sample) return res.status(404).json({ error: 'Project not found' });
        
        // Ensure it actually has an arrangement
        if (!sample.arrangement) {
             return res.status(400).json({ error: 'Selected item is a sample, not a project.' });
        }

        res.json({
            id: sample.id,
            filename: sample.filename,
            url: sample.url,
            arrangement: sample.arrangement,
            projectFile: sample.projectFile,
            metadata: {
                bpm: sample.bpm,
                key: sample.key,
                duration: sample.duration
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// List Packs/Libraries
app.get('/api/fuji/libraries', async (req, res) => {
    try {
        const packs = await db.samplePack.findMany({
            include: { _count: { select: { samples: true } } }
        });
        res.json(packs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.API_PORT || 3001;

// ---------------------------------------------------------------------------
// Embeddable audio player (used by Discord/Reddit embeds via iframe)
// ---------------------------------------------------------------------------
app.get('/player/:username/:slug', async (req: any, res) => {
    const { username, slug } = req.params;
    try {
        const profile = await db.musicianProfile.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } }
        });
        if (!profile) return res.status(404).send('Not found');

        const track = await db.track.findFirst({
            where: { profileId: profile.id, isPublic: true, slug: { equals: slug, mode: 'insensitive' } },
            include: { profile: true }
        }) as any;
        if (!track) return res.status(404).send('Not found');

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const audioUrl = track.url ? `${baseUrl}${track.url}` : '';
        const imageUrl = track.coverUrl ? `${baseUrl}${track.coverUrl}` : '';
        const artistName = track.profile.displayName || track.profile.username || username;

        const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(track.title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1A1E2E;font-family:system-ui,sans-serif;color:#fff;display:flex;align-items:center;padding:10px 14px;height:80px;overflow:hidden}
.cover{width:54px;height:54px;border-radius:6px;object-fit:cover;flex-shrink:0;background:#2a2e3e}
.info{flex:1;padding:0 12px;min-width:0}
.title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.artist{font-size:11px;color:#9a9db0;margin-top:2px}
audio{width:100%;margin-top:5px;height:24px;accent-color:#7289da}
a{color:#7289da;text-decoration:none;font-size:11px}
</style>
</head><body>
${imageUrl ? `<img class="cover" src="${escapeHtml(imageUrl)}" alt="">` : '<div class="cover"></div>'}
<div class="info">
  <div class="title">${escapeHtml(track.title)}</div>
  <div class="artist">${escapeHtml(artistName)} &mdash; <a href="${baseUrl}/profile/${escapeHtml(username)}/${escapeHtml(slug)}" target="_blank">Open in Fuji Studio</a></div>
  ${audioUrl ? `<audio controls src="${escapeHtml(audioUrl)}"></audio>` : '<div style="font-size:11px;color:#666;margin-top:6px">Audio unavailable</div>'}
</div>
</body></html>`;

        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Content-Security-Policy', "frame-ancestors *");
        res.send(html);
    } catch (e: any) {
        res.status(500).send('Error');
    }
});

// oEmbed endpoint (used by Reddit and other platforms supporting oEmbed)
app.get('/api/oembed', async (req: any, res) => {
    const { url, format } = req.query as { url: string; format: string };
    if (!url) return res.status(400).json({ error: 'url parameter required' });

    const match = decodeURIComponent(url).match(/\/profile\/([^/?#]+)\/([^/?#]+)/);
    if (!match) return res.status(404).json({ error: 'Not a track URL' });
    const [, username, slug] = match;

    try {
        const profile = await db.musicianProfile.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } }
        });
        if (!profile) return res.status(404).json({ error: 'Not found' });

        const track = await db.track.findFirst({
            where: { profileId: profile.id, isPublic: true, slug: { equals: slug, mode: 'insensitive' } },
            include: { profile: true }
        }) as any;
        if (!track) return res.status(404).json({ error: 'Not found' });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const artistName = track.profile.displayName || track.profile.username || username;
        const playerUrl = `${baseUrl}/player/${username}/${slug}`;
        const coverUrl = track.coverUrl ? `${baseUrl}${track.coverUrl}` : undefined;

        const payload: any = {
            type: 'rich',
            version: '1.0',
            title: `${track.title} by ${artistName}`,
            author_name: artistName,
            author_url: `${baseUrl}/profile/${username}`,
            provider_name: 'Fuji Studio',
            provider_url: baseUrl,
            width: 480,
            height: 80,
            html: `<iframe src="${playerUrl}" width="480" height="80" frameborder="0" allowtransparency="true" allow="autoplay"></iframe>`,
        };
        if (coverUrl) { payload.thumbnail_url = coverUrl; payload.thumbnail_width = 500; payload.thumbnail_height = 500; }

        if (format === 'xml') {
            res.setHeader('Content-Type', 'text/xml; charset=utf-8');
            return res.send(`<?xml version="1.0" encoding="utf-8"?>
<oembed>
  <type>rich</type><version>1.0</version>
  <title>${escapeHtml(payload.title)}</title>
  <author_name>${escapeHtml(artistName)}</author_name>
  <width>480</width><height>80</height>
  <html>${escapeHtml(payload.html)}</html>
</oembed>`);
        }
        res.json(payload);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════
// Beat Battle API
// ═══════════════════════════════════════════════════

// --- Public: List battles (with filtering) ---
app.get('/api/beat-battle/battles', async (req: any, res) => {
    try {
        const guildId = req.query.guildId as string | undefined;
        const status = req.query.status as string | undefined;

        // 'default-guild' is the public-page sentinel meaning "all guilds"
        const where: any = {};
        if (guildId && guildId !== 'default-guild') where.guildId = guildId;
        if (status) where.status = status;

        const battles = await db.beatBattle.findMany({
            where,
            include: {
                sponsor: { include: { links: true } },
                _count: { select: { entries: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Track page view analytics
        if (req.session?.user?.id) {
            const activeBattle = battles.find((b: any) => b.status !== 'completed');
            if (activeBattle) {
                await db.battleAnalytics.create({
                    data: { battleId: activeBattle.id, eventType: 'page_view', userId: req.session.user.id },
                }).catch(() => {});
            }
        }

        res.json(battles);
    } catch (e: any) {
        logger.error('Beat Battle API: list battles failed', e);
        res.status(500).json({ error: e.message });
    }
});

// --- Public: Get single battle with entries ---
app.get('/api/beat-battle/battles/:id', async (req: any, res) => {
    try {
        const battle = await db.beatBattle.findUnique({
            where: { id: req.params.id },
            include: {
                sponsor: { include: { links: true } },
                entries: {
                    orderBy: { voteCount: 'desc' },
                    select: { id: true, userId: true, username: true, trackTitle: true, audioUrl: true, coverUrl: true, avatarUrl: true, duration: true, voteCount: true, source: true, createdAt: true },
                },
            },
        });

        if (!battle) return res.status(404).json({ error: 'Battle not found' });

        // Include discordInviteUrl from guild settings
        const guildSettings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } }).catch(() => null);

        // Track page view
        if (req.session?.user?.id) {
            await db.battleAnalytics.create({
                data: { battleId: battle.id, eventType: 'page_view', userId: req.session.user.id },
            }).catch(() => {});
        }

        res.json({ ...battle, discordInviteUrl: guildSettings?.discordInviteUrl || null });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Public: Get archive (completed battles) ---
app.get('/api/beat-battle/archive', async (req: any, res) => {
    try {
        const guildId = req.query.guildId as string | undefined;
        const archiveWhere: any = { status: 'completed' };
        if (guildId && guildId !== 'default-guild') archiveWhere.guildId = guildId;
        const battles = await db.beatBattle.findMany({
            where: archiveWhere,
            include: {
                sponsor: true,
                entries: {
                    orderBy: { voteCount: 'desc' },
                    take: 3,
                    select: { id: true, userId: true, username: true, trackTitle: true, audioUrl: true, coverUrl: true, avatarUrl: true, voteCount: true },
                },
                _count: { select: { entries: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });
        res.json(battles);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Public: Get single entry with battle context ---
app.get('/api/beat-battle/entries/:entryId', async (req: any, res) => {
    try {
        const entry = await db.battleEntry.findUnique({
            where: { id: req.params.entryId },
            include: {
                battle: {
                    select: { id: true, title: true, status: true, description: true, guildId: true },
                },
            },
        });

        if (!entry) return res.status(404).json({ error: 'Entry not found' });

        res.json(entry);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Auth: Vote on an entry ---
app.post('/api/beat-battle/entries/:entryId/vote', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const entryId = req.params.entryId;

        const entry = await db.battleEntry.findUnique({
            where: { id: entryId },
            include: { battle: true },
        });

        if (!entry) return res.status(404).json({ error: 'Entry not found' });

        if (entry.battle.status !== 'voting') {
            return res.status(400).json({ error: 'Voting is not open for this battle' });
        }

        if (entry.userId === userId) {
            return res.status(400).json({ error: 'You cannot vote for your own submission' });
        }

        // Check duplicate vote — if exists, toggle (remove) it
        const existingVote = await db.battleVote.findUnique({
            where: { entryId_userId: { entryId, userId } },
        });
        if (existingVote) {
            await db.battleVote.delete({ where: { entryId_userId: { entryId, userId } } });
            const updated = await db.battleEntry.update({
                where: { id: entryId },
                data: { voteCount: { decrement: 1 } },
            });
            return res.json({ voteCount: updated.voteCount, voted: false });
        }

        // Check per-battle vote limit
        if (entry.battle.maxVotesPerUser > 0) {
            const userVoteCount = await db.battleVote.count({
                where: {
                    userId,
                    entry: { battleId: entry.battleId },
                },
            });
            if (userVoteCount >= entry.battle.maxVotesPerUser) {
                return res.status(400).json({ error: `You've used all ${entry.battle.maxVotesPerUser} vote(s) for this battle. Remove a vote from another entry first.` });
            }
        }

        await db.battleVote.create({
            data: { entryId, userId, source: 'web' },
        });

        const updated = await db.battleEntry.update({
            where: { id: entryId },
            data: { voteCount: { increment: 1 } },
        });

        await db.battleAnalytics.create({
            data: { battleId: entry.battleId, eventType: 'vote_cast', userId },
        }).catch(() => {});

        // Sync vote count to Discord embed
        try {
            const { BeatBattlePlugin } = await import('../bot/plugins/BeatBattlePlugin.js');
            // The bot instance updates the Discord message asynchronously
            // We can't easily access the running plugin instance here, so we rely on the denormalized count
            // The Discord embed will update on next interaction or can be triggered via the bot side
        } catch {}

        res.json({ voteCount: updated.voteCount, voted: true });
    } catch (e: any) {
        logger.error('Beat Battle API: vote failed', e);
        res.status(500).json({ error: e.message });
    }
});

// --- Auth: Submit entry via web ---
app.post('/api/beat-battle/battles/:battleId/submit', requireAuth, upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'artwork', maxCount: 1 },
]), async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const battleId = req.params.battleId;
        const title = req.body.title;

        if (!title) return res.status(400).json({ error: 'Title is required' });

        const battle = await db.beatBattle.findUnique({ where: { id: battleId } });
        if (!battle) return res.status(404).json({ error: 'Battle not found' });
        if (battle.status !== 'active') return res.status(400).json({ error: 'This battle is not accepting submissions' });

        // Check duplicate entry
        const existing = await db.battleEntry.findUnique({
            where: { battleId_userId: { battleId, userId } },
        });
        if (existing) return res.status(400).json({ error: 'You already submitted to this battle' });

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const audioFile = files['audio']?.[0];
        if (!audioFile) return res.status(400).json({ error: 'Audio file is required' });

        // Move audio to battles folder
        const battlesDir = path.join(PROJECT_ROOT, 'public/uploads/battles');
        if (!fs.existsSync(battlesDir)) fs.mkdirSync(battlesDir, { recursive: true });

        const uniqueName = `battle-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(audioFile.originalname)}`;
        const destPath = path.join(battlesDir, uniqueName);
        fs.renameSync(audioFile.path, destPath);
        const audioUrl = `/uploads/battles/${uniqueName}`;

        let coverUrl: string | undefined;
        const artworkFile = files['artwork']?.[0];
        if (artworkFile) {
            coverUrl = `/uploads/artwork/${path.basename(artworkFile.path)}`;
        }

        // Get username from Discord API
        let username = 'Unknown';
        try {
            const userRes = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
                headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                timeout: 5000,
            });
            username = userRes.data.global_name || userRes.data.username || 'Unknown';
        } catch {}

        const entry = await db.battleEntry.create({
            data: {
                battleId,
                userId,
                username,
                trackTitle: title,
                audioUrl,
                coverUrl,
                source: 'web',
            },
        });

        await db.battleAnalytics.create({
            data: { battleId, eventType: 'submission', userId },
        }).catch(() => {});

        res.json(entry);
    } catch (e: any) {
        logger.error('Beat Battle API: web submit failed', e);
        res.status(500).json({ error: e.message });
    }
});

// --- Admin: Create battle ---
app.post('/api/beat-battle/admin/battles', requireAdmin, async (req: any, res) => {
    try {
        const { title, description, rules, prizes, guildId, submissionStart, submissionEnd, votingStart, votingEnd, sponsorId, announcementChannelId, categoryId, maxVotesPerUser } = req.body;

        if (!title) return res.status(400).json({ error: 'Title is required' });

        const effectiveGuildId = guildId || 'default-guild';

        const battle = await db.beatBattle.create({
            data: {
                guildId: effectiveGuildId,
                title,
                description,
                rules,
                prizes: prizes || [],
                status: submissionStart && new Date(submissionStart) > new Date() ? 'upcoming' : 'active',
                submissionStart: submissionStart ? new Date(submissionStart) : new Date(),
                submissionEnd: submissionEnd ? new Date(submissionEnd) : null,
                votingStart: votingStart ? new Date(votingStart) : null,
                votingEnd: votingEnd ? new Date(votingEnd) : null,
                sponsorId: sponsorId || null,
                announcementChannelId: announcementChannelId || null,
                categoryId: categoryId || null,
                maxVotesPerUser: maxVotesPerUser != null ? Number(maxVotesPerUser) : 0,
                createdBy: req.session.user.id,
            },
            include: { sponsor: { include: { links: true } } },
        });

        // Log action
        await db.actionLog.create({
            data: {
                pluginId: 'beat-battle',
                guildId: effectiveGuildId,
                action: 'battle_created',
                executorId: req.session.user.id,
                details: { title: battle.title, status: battle.status },
            },
        }).catch(() => {});

        res.json(battle);
    } catch (e: any) {
        logger.error('Beat Battle API: create failed', e);
        res.status(500).json({ error: e.message });
    }
});

// --- Admin: Update battle ---
app.patch('/api/beat-battle/admin/battles/:id', requireAdmin, async (req: any, res) => {
    try {
        const { title, description, rules, prizes, status, submissionStart, submissionEnd, votingStart, votingEnd, sponsorId, announcementChannelId, categoryId, maxVotesPerUser } = req.body;

        // Fetch old battle to detect status change
        const oldBattle = await db.beatBattle.findUnique({ where: { id: req.params.id } });
        if (!oldBattle) return res.status(404).json({ error: 'Battle not found' });

        const data: any = {};
        if (title !== undefined) data.title = title;
        if (description !== undefined) data.description = description;
        if (rules !== undefined) data.rules = rules;
        if (prizes !== undefined) data.prizes = prizes;
        if (status !== undefined) data.status = status;
        if (submissionStart !== undefined) data.submissionStart = submissionStart ? new Date(submissionStart) : null;
        if (submissionEnd !== undefined) data.submissionEnd = submissionEnd ? new Date(submissionEnd) : null;
        if (votingStart !== undefined) data.votingStart = votingStart ? new Date(votingStart) : null;
        if (votingEnd !== undefined) data.votingEnd = votingEnd ? new Date(votingEnd) : null;
        if (sponsorId !== undefined) data.sponsorId = sponsorId || null;
        if (announcementChannelId !== undefined) data.announcementChannelId = announcementChannelId;
        if (categoryId !== undefined) data.categoryId = categoryId;
        if (maxVotesPerUser !== undefined) data.maxVotesPerUser = Number(maxVotesPerUser);

        const battle = await db.beatBattle.update({
            where: { id: req.params.id },
            data,
            include: { sponsor: { include: { links: true } } },
        });

        // --- Trigger lifecycle side-effects on manual status change ---
        const newStatus = status;
        const statusChanged = newStatus && newStatus !== oldBattle.status;
        if (statusChanged) {
            const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });

            // → Active: create submissions channel if missing
            if (newStatus === 'active' && !battle.submissionChannelId) {
                try {
                    const channelName = `submissions-${battle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
                    const catId = battle.categoryId || settings?.submissionCategoryId || settings?.battleCategoryId || undefined;
                    const body: any = {
                        name: channelName, type: 0,
                        topic: `Submit your beats for: ${battle.title}`,
                        rate_limit_per_user: 10,
                        permission_overwrites: [{ id: battle.guildId, type: 0, allow: '101376', deny: '0' }],
                    };
                    if (catId) body.parent_id = catId;
                    const chRes = await discordReq('POST', `/guilds/${battle.guildId}/channels`, body);
                    const chId = chRes.data.id;
                    await db.beatBattle.update({ where: { id: battle.id }, data: { submissionChannelId: chId } });
                    battle.submissionChannelId = chId;
                    await discordReq('POST', `/channels/${chId}/messages`, {
                        embeds: [{ title: `🎵 ${battle.title} — Submissions Open!`, description: 'Drop your audio file (MP3/WAV) in this channel to submit.\n\nOne entry per person. Good luck!', color: 0x2B8C71, footer: { text: 'Fuji Studio Beat Battle' }, timestamp: new Date().toISOString() }],
                    });
                } catch (err: any) {
                    logger.error(`Beat Battle: failed to create channel on manual activate: ${err.message}`);
                }
            }

            // → Voting: lock submissions channel + add vote buttons
            if (newStatus === 'voting' && battle.submissionChannelId) {
                try {
                    await discordReq('PUT', `/channels/${battle.submissionChannelId}/permissions/${battle.guildId}`, {
                        type: 0, allow: '66560', deny: '34816',
                    });
                    const entryCount = await db.battleEntry.count({ where: { battleId: battle.id } });
                    await discordReq('POST', `/channels/${battle.submissionChannelId}/messages`, {
                        embeds: [{ title: '🔒 Submissions Closed', description: `Submissions for **${battle.title}** are now closed.\n\n**${entryCount}** ${entryCount === 1 ? 'entry' : 'entries'} received. Voting is now open — hit the 🔥 button on your favorite beat!`, color: 0xFFA500, footer: { text: 'Fuji Studio Beat Battle' }, timestamp: new Date().toISOString() }],
                    });

                    // Add vote buttons to all existing entry embeds
                    const entries = await db.battleEntry.findMany({
                        where: { battleId: battle.id, discordMsgId: { not: null } },
                    });
                    for (const entry of entries) {
                        try {
                            await discordReq('PATCH', `/channels/${battle.submissionChannelId}/messages/${entry.discordMsgId}`, {
                                components: [{
                                    type: 1,
                                    components: [{
                                        type: 2, style: 1, custom_id: `battle_vote_${entry.id}`,
                                        label: `Vote (${entry.voteCount})`, emoji: { name: '🔥' },
                                    }],
                                }],
                            });
                        } catch {}
                    }
                    logger.info(`Beat Battle: added vote buttons to ${entries.length} entries on manual voting transition`);
                } catch (err: any) {
                    logger.error(`Beat Battle: failed to lock channel on manual voting: ${err.message}`);
                }
            }

            // → Completed: determine winner, post result, archive
            if (newStatus === 'completed') {
                const winner = await db.battleEntry.findFirst({ where: { battleId: battle.id }, orderBy: { voteCount: 'desc' } });
                if (winner) {
                    await db.beatBattle.update({ where: { id: battle.id }, data: { winnerEntryId: winner.id } });
                    if (battle.submissionChannelId) {
                        try {
                            await discordReq('POST', `/channels/${battle.submissionChannelId}/messages`, {
                                embeds: [{ title: `🏆 ${battle.title} — Winner!`, description: `Congratulations to <@${winner.userId}>!\n\n**"${winner.trackTitle}"** with **${winner.voteCount}** votes!`, color: 0xFFD700, footer: { text: 'Fuji Studio Beat Battle' }, timestamp: new Date().toISOString() }],
                            });
                        } catch {}
                    }
                }
                if (battle.submissionChannelId && settings?.archiveCategoryId) {
                    try {
                        await discordReq('PATCH', `/channels/${battle.submissionChannelId}`, {
                            parent_id: settings.archiveCategoryId,
                            name: `archived-${battle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 25)}`,
                        });
                    } catch {}
                }
            }

            // Post announcement for the new status
            const settings2 = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
            await postBattleAnnouncement(battle, settings2);
        }

        await db.actionLog.create({
            data: {
                pluginId: 'beat-battle',
                guildId: battle.guildId,
                action: 'battle_updated',
                executorId: req.session.user.id,
                details: { title: battle.title, changes: Object.keys(data) },
            },
        }).catch(() => {});

        res.json(battle);
    } catch (e: any) {
        logger.error('Beat Battle API: update failed', e);
        res.status(500).json({ error: e.message });
    }
});

// --- Admin: Delete battle ---
app.delete('/api/beat-battle/admin/battles/:id', requireAdmin, async (req: any, res) => {
    try {
        const battle = await db.beatBattle.findUnique({ where: { id: req.params.id } });
        if (!battle) return res.status(404).json({ error: 'Battle not found' });

        await db.beatBattle.delete({ where: { id: req.params.id } });

        await db.actionLog.create({
            data: {
                pluginId: 'beat-battle',
                guildId: battle.guildId,
                action: 'battle_deleted',
                executorId: req.session.user.id,
                details: { title: battle.title },
            },
        }).catch(() => {});

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Public: Get battle submissions for a user (profile) ---
app.get('/api/beat-battle/user/:userId/entries', async (req: any, res) => {
    try {
        const entries = await db.battleEntry.findMany({
            where: { userId: req.params.userId },
            include: {
                battle: {
                    select: { id: true, title: true, status: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // For each entry, determine placement (rank by voteCount in that battle)
        const enriched = await Promise.all(entries.map(async (entry: any) => {
            const allEntries = await db.battleEntry.findMany({
                where: { battleId: entry.battleId },
                orderBy: { voteCount: 'desc' },
                select: { id: true, voteCount: true },
            });
            const placement = allEntries.findIndex((e: any) => e.id === entry.id) + 1;
            const totalEntries = allEntries.length;
            const isWinner = placement === 1 && entry.battle.status === 'completed' && entry.voteCount > 0;
            return {
                id: entry.id,
                trackTitle: entry.trackTitle,
                audioUrl: entry.audioUrl,
                coverUrl: entry.coverUrl,
                avatarUrl: entry.avatarUrl,
                voteCount: entry.voteCount,
                createdAt: entry.createdAt,
                battle: entry.battle,
                placement,
                totalEntries,
                isWinner,
            };
        }));

        res.json(enriched);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Shared helper: post a battle announcement embed to a Discord channel via REST ---
async function postBattleAnnouncement(battle: any, settings: any): Promise<string | null> {
    const annChannelId = battle.announcementChannelId || settings?.announcementChannelId;
    if (!annChannelId) return 'No announcement channel configured. Set one in Beat Battle settings.';

    const apiUrl = process.env.API_URL || 'https://fujistudio.app';
    let embed: any;

    if (battle.status === 'upcoming' || battle.status === 'active') {
        const fields: any[] = [];
        if (battle.submissionStart) {
            fields.push({ name: 'Submissions Open', value: `<t:${Math.floor(new Date(battle.submissionStart).getTime() / 1000)}:R>`, inline: true });
        }
        if (battle.submissionEnd) {
            fields.push({ name: 'Submissions Close', value: `<t:${Math.floor(new Date(battle.submissionEnd).getTime() / 1000)}:R>`, inline: true });
        }
        if (battle.submissionChannelId) {
            fields.push({ name: 'Submissions Channel', value: `<#${battle.submissionChannelId}>`, inline: true });
        }
        if (battle.rules) fields.push({ name: '📋 Rules', value: battle.rules });
        fields.push({ name: '🌐 Website', value: `[View on Fuji Studio](${apiUrl}/battles)` });
        embed = {
            title: `🎤 New Beat Battle: ${battle.title}`,
            description: battle.description || 'A new battle has begun! Submit your beats.',
            color: 0x2B8C71,
            fields,
            footer: { text: 'Fuji Studio Beat Battle' },
            timestamp: new Date().toISOString(),
        };
    } else if (battle.status === 'voting') {
        const fields: any[] = [];
        if (battle.votingEnd) {
            fields.push({ name: 'Voting Ends', value: `<t:${Math.floor(new Date(battle.votingEnd).getTime() / 1000)}:R>` });
        }
        embed = {
            title: `🗳️ ${battle.title} — Voting is Now Open!`,
            description: 'Submissions are closed. Head to the submissions channel and hit the 🔥 Vote button on your favorite beat, or vote on the website!',
            color: 0xFFA500,
            fields,
            footer: { text: 'Fuji Studio Beat Battle' },
            timestamp: new Date().toISOString(),
        };
    } else if (battle.status === 'completed') {
        const winner = battle.winnerEntryId
            ? await db.battleEntry.findUnique({ where: { id: battle.winnerEntryId } })
            : await db.battleEntry.findFirst({ where: { battleId: battle.id }, orderBy: { voteCount: 'desc' } });
        if (!winner) return null;
        embed = {
            title: `🏆 ${battle.title} — Winner!`,
            description: `Congratulations to <@${winner.userId}>!\n\n**"${winner.trackTitle}"** with **${winner.voteCount}** votes!`,
            color: 0xFFD700,
            fields: [{ name: '🎧 Listen', value: `[Play on Fuji Studio](${apiUrl}/battles)` }],
            footer: { text: 'Fuji Studio Beat Battle' },
            timestamp: new Date().toISOString(),
        };
    } else {
        return null;
    }

    try {
        await discordReq('POST', `/channels/${annChannelId}/messages`, { embeds: [embed] });
        return null;
    } catch (err: any) {
        const status = err.response?.status;
        if (status === 403) {
            return `Bot lacks Send Messages permission in <#${annChannelId}>. Grant the bot "Send Messages" in that channel, then try again.`;
        }
        if (status === 404) {
            return `Announcement channel not found (ID: ${annChannelId}). Check the channel ID in Beat Battle settings.`;
        }
        logger.error(`Beat Battle: failed to post announcement to channel ${annChannelId}: ${err.message}`);
        return `Discord error: ${err.message}`;
    }
}

// --- Admin: Manually trigger announcement for current battle stage ---
app.post('/api/beat-battle/admin/battles/:id/announce', requireAdmin, async (req: any, res) => {
    try {
        const battle = await db.beatBattle.findUnique({ where: { id: req.params.id } });
        if (!battle) return res.status(404).json({ error: 'Battle not found' });

        const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
        const announceError = await postBattleAnnouncement(battle, settings);

        await db.actionLog.create({
            data: {
                pluginId: 'beat-battle',
                guildId: battle.guildId,
                action: 'announcement_posted',
                executorId: req.session.user.id,
                details: { title: battle.title, status: battle.status, ok: !announceError },
            },
        }).catch(() => {});

        if (announceError) {
            return res.status(400).json({ error: announceError });
        }
        res.json({ success: true, message: 'Announcement posted!' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Admin: CRUD Sponsors ---
app.get('/api/beat-battle/admin/sponsors', requireAdmin, async (req: any, res) => {
    try {
        const guildId = (req.query.guildId as string) || 'default-guild';
        const sponsors = await db.battleSponsor.findMany({
            where: { guildId },
            include: { links: true, _count: { select: { battles: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(sponsors);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/beat-battle/admin/sponsors', requireAdmin, async (req: any, res) => {
    try {
        const { name, logoUrl, websiteUrl, description, guildId, links } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const sponsor = await db.battleSponsor.create({
            data: {
                guildId: guildId || 'default-guild',
                name,
                logoUrl,
                websiteUrl,
                description,
                links: links?.length ? { create: links.map((l: any) => ({ label: l.label, url: l.url })) } : undefined,
            },
            include: { links: true },
        });
        res.json(sponsor);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/beat-battle/admin/sponsors/:id', requireAdmin, async (req: any, res) => {
    try {
        const { name, logoUrl, websiteUrl, description, isActive, links } = req.body;
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (logoUrl !== undefined) data.logoUrl = logoUrl;
        if (websiteUrl !== undefined) data.websiteUrl = websiteUrl;
        if (description !== undefined) data.description = description;
        if (isActive !== undefined) data.isActive = isActive;

        const sponsor = await db.battleSponsor.update({
            where: { id: req.params.id },
            data,
            include: { links: true },
        });

        // Replace links if provided
        if (links !== undefined) {
            await db.battleSponsorLink.deleteMany({ where: { sponsorId: sponsor.id } });
            const validLinks = links.filter((l: any) => l.label && l.url);
            if (validLinks.length > 0) {
                await db.battleSponsorLink.createMany({
                    data: validLinks.map((l: any) => ({ sponsorId: sponsor.id, label: l.label, url: l.url })),
                });
            }
        }

        const updated = await db.battleSponsor.findUnique({ where: { id: sponsor.id }, include: { links: true, _count: { select: { battles: true } } } });
        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/beat-battle/admin/sponsors/:id', requireAdmin, async (req: any, res) => {
    try {
        await db.battleSponsor.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Sponsor Analytics: Track link clicks ---
app.post('/api/beat-battle/sponsor-links/:linkId/click', async (req: any, res) => {
    try {
        const link = await db.battleSponsorLink.update({
            where: { id: req.params.linkId },
            data: { clicks: { increment: 1 } },
        });

        // Also record in analytics
        const sponsor = await db.battleSponsor.findUnique({
            where: { id: link.sponsorId },
            include: { battles: { take: 1, orderBy: { createdAt: 'desc' } } },
        });
        if (sponsor?.battles?.[0]) {
            await db.battleAnalytics.create({
                data: {
                    battleId: sponsor.battles[0].id,
                    eventType: 'sponsor_click',
                    userId: req.session?.user?.id,
                    metadata: { linkId: link.id, label: link.label },
                },
            }).catch(() => {});
        }

        res.json({ clicks: link.clicks });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Admin: Analytics report for a battle ---
app.get('/api/beat-battle/admin/battles/:id/analytics', requireAdmin, async (req: any, res) => {
    try {
        const battleId = req.params.id;
        const battle = await db.beatBattle.findUnique({
            where: { id: battleId },
            include: {
                sponsor: { include: { links: true } },
                entries: { select: { id: true, voteCount: true, userId: true } },
            },
        });
        if (!battle) return res.status(404).json({ error: 'Battle not found' });

        // Aggregate analytics
        const analytics = await db.battleAnalytics.groupBy({
            by: ['eventType'],
            where: { battleId },
            _count: true,
        });

        const analyticsMap: Record<string, number> = {};
        for (const a of analytics) {
            analyticsMap[a.eventType] = a._count;
        }

        // Unique participants (unique voters + submitters)
        const uniqueVoters = await db.battleVote.findMany({
            where: { entry: { battleId } },
            distinct: ['userId'],
            select: { userId: true },
        });

        const uniqueSubmitters = new Set(battle.entries.map(e => e.userId));
        const allParticipants = new Set([...uniqueVoters.map(v => v.userId), ...uniqueSubmitters]);

        const report = {
            battleTitle: battle.title,
            status: battle.status,
            totalEntries: battle.entries.length,
            totalVotesCast: analyticsMap['vote_cast'] || 0,
            pageViews: analyticsMap['page_view'] || 0,
            sponsorClicks: analyticsMap['sponsor_click'] || 0,
            uniqueParticipants: allParticipants.size,
            sponsorLinkBreakdown: battle.sponsor?.links?.map(l => ({ label: l.label, url: l.url, clicks: l.clicks })) || [],
        };

        res.json(report);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Admin: Backfill old battle data ---
app.post('/api/beat-battle/admin/backfill', requireAdmin, async (req: any, res) => {
    try {
        const { title, description, winners, sponsorName, completedAt, guildId } = req.body;

        if (!title) return res.status(400).json({ error: 'Title is required' });

        const effectiveGuildId = guildId || 'default-guild';

        // Create sponsor if provided
        let sponsorId: string | null = null;
        if (sponsorName) {
            const sponsor = await db.battleSponsor.create({
                data: { guildId: effectiveGuildId, name: sponsorName },
            });
            sponsorId = sponsor.id;
        }

        const battle = await db.beatBattle.create({
            data: {
                guildId: effectiveGuildId,
                title,
                description,
                status: 'completed',
                sponsorId,
                createdBy: req.session.user.id,
                submissionStart: completedAt ? new Date(completedAt) : new Date(),
                submissionEnd: completedAt ? new Date(completedAt) : new Date(),
                votingEnd: completedAt ? new Date(completedAt) : new Date(),
            },
        });

        // Create winner entries (one per winner, descending vote counts for ranking)
        const validWinners = (winners || []).filter((w: any) => w.userId && w.trackTitle);
        let firstEntryId: string | null = null;
        for (let i = 0; i < validWinners.length; i++) {
            const w = validWinners[i];
            const entry = await db.battleEntry.create({
                data: {
                    battleId: battle.id,
                    userId: w.userId,
                    username: w.username || 'Unknown',
                    trackTitle: w.trackTitle,
                    audioUrl: w.audioUrl || '',
                    voteCount: validWinners.length - i, // 1st place gets highest count
                    source: 'backfill',
                },
            });
            if (i === 0) firstEntryId = entry.id;
        }

        if (firstEntryId) {
            await db.beatBattle.update({
                where: { id: battle.id },
                data: { winnerEntryId: firstEntryId },
            });
        }

        res.json(battle);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Beat Battle Settings ---
app.get('/api/guilds/:guildId/beat-battle/settings', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'beat-battle') && !isTrueAdmin(guildId, req)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const settings = await db.beatBattleSettings.findUnique({ where: { guildId } });
        res.json(settings || {
            guildId,
            battleCategoryId: null,
            announcementChannelId: null,
            chatChannelId: null,
            submissionCategoryId: null,
            archiveCategoryId: null,
            discordInviteUrl: null,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/guilds/:guildId/beat-battle/settings', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'beat-battle') && !isTrueAdmin(guildId, req)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { battleCategoryId, announcementChannelId, chatChannelId, submissionCategoryId, archiveCategoryId, discordInviteUrl } = req.body;

        const settings = await db.beatBattleSettings.upsert({
            where: { guildId },
            update: { battleCategoryId, announcementChannelId, chatChannelId, submissionCategoryId, archiveCategoryId, discordInviteUrl },
            create: { guildId, battleCategoryId, announcementChannelId, chatChannelId, submissionCategoryId, archiveCategoryId, discordInviteUrl },
        });
        res.json(settings);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Serve Dashboard Dist in Production ---
const distPath = path.join(PROJECT_ROOT, 'dashboard/dist');
const indexHtml = path.join(distPath, 'index.html');

if (fs.existsSync(distPath)) {
    // 1. Serve static files (no index)
    app.use((req, res, next) => {
        next();
    }, express.static(distPath, { index: false }));

    // 2. SPA Catch-all
    const BOT_UA = /discordbot|twitterbot|facebookexternalhit|slackbot|linkedinbot|whatsapp|telegrambot|redditbot|pinterest|googlebot|bingbot/i;
    const TRACK_PATH = /^\/(profile|track)\/([^/?#]+)\/([^/?#]+)\/?$/;

    app.get('*', async (req: any, res, next) => {
        // API/Uploads go through
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
            return next();
        }

        // Bot request on a track URL → inject OG meta tags
        const ua = req.headers['user-agent'] || '';
        const trackMatch = req.path.match(TRACK_PATH);
        logger.info(`[SPA] path=${req.path} ua="${ua.slice(0,80)}" isBot=${BOT_UA.test(ua)} trackMatch=${!!trackMatch}`);
        if (BOT_UA.test(ua) && trackMatch) {
            try {
                const [, , username, slug] = trackMatch;
                const profile = await db.musicianProfile.findFirst({
                    where: { username: { equals: username, mode: 'insensitive' } }
                });
                if (profile) {
                    const track = await db.track.findFirst({
                        where: { profileId: profile.id, isPublic: true, slug: { equals: slug, mode: 'insensitive' } },
                        include: { profile: true }
                    }) as any;
                    if (track) {
                        const baseUrl = `${req.protocol}://${req.get('host')}`;
                        const trackUrl = `${baseUrl}/profile/${username}/${slug}`;
                        const audioUrl = track.url ? `${baseUrl}${track.url}` : '';
                        const imageUrl = track.coverUrl ? `${baseUrl}${track.coverUrl}` : `${baseUrl}/og-default.png`;
                        const artistName: string = track.profile.displayName || track.profile.username || username;
                        const description: string = track.description
                            ? track.description.slice(0, 200)
                            : `Listen to ${track.title} by ${artistName} on Fuji Studio`;
                        const playerUrl = `${baseUrl}/player/${username}/${slug}`;
                        const oembedUrl = `${baseUrl}/api/oembed?url=${encodeURIComponent(trackUrl)}&format=json`;

                        const metaTags = [
                            `<meta charset="utf-8">`,
                            `<title>${escapeHtml(track.title)} by ${escapeHtml(artistName)} | Fuji Studio</title>`,
                            `<meta property="og:title" content="${escapeHtml(track.title)} by ${escapeHtml(artistName)}">`,
                            `<meta property="og:description" content="${escapeHtml(description)}">`,
                            `<meta property="og:type" content="music.song">`,
                            `<meta property="og:url" content="${trackUrl}">`,
                            `<meta property="og:image" content="${imageUrl}">`,
                            `<meta property="og:image:width" content="500">`,
                            `<meta property="og:image:height" content="500">`,
                            `<meta property="og:site_name" content="Fuji Studio">`,
                            `<meta name="theme-color" content="#5865F2">`,
                            audioUrl ? `<meta property="og:audio" content="${audioUrl}">` : '',
                            audioUrl ? `<meta property="og:audio:secure_url" content="${audioUrl}">` : '',
                            audioUrl ? `<meta property="og:audio:type" content="audio/mpeg">` : '',
                            `<meta name="twitter:card" content="player">`,
                            `<meta name="twitter:title" content="${escapeHtml(track.title)} by ${escapeHtml(artistName)}">`,
                            `<meta name="twitter:description" content="${escapeHtml(description)}">`,
                            `<meta name="twitter:image" content="${imageUrl}">`,
                            `<meta name="twitter:player" content="${playerUrl}">`,
                            `<meta name="twitter:player:width" content="480">`,
                            `<meta name="twitter:player:height" content="80">`,
                            `<link rel="alternate" type="application/json+oembed" href="${oembedUrl}" title="${escapeHtml(track.title)}">`,
                        ].filter(Boolean).join('\n');

                        return res.send(`<!DOCTYPE html><html><head>\n${metaTags}\n</head><body></body></html>`);
                    }
                }
            } catch (err: any) {
                logger.warn(`[SPA bot-detect] error: ${err.message}`);
                // Fall through to SPA on error
            }
        }

        // Everything else gets index.html
        if (fs.existsSync(indexHtml)) {
             // CRITICAL: Prevent index.html from being cached so users always get the latest JS build hash
             res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
             res.setHeader('Pragma', 'no-cache');
             res.setHeader('Expires', '0');
             res.setHeader('X-Powered-By-Fuji', 'Express-SPA');
             res.sendFile(indexHtml);
        } else {
             next();
        }
    });
}

// --- Beat Battle Lifecycle (runs in API process so it's always active) ---
async function runBeatBattleLifecycle(): Promise<void> {
    const now = new Date();
    try {
        // ---------- 1. Upcoming → Active (submissionStart passed) ----------
        const toActivate = await db.beatBattle.findMany({
            where: { status: 'upcoming', submissionStart: { lte: now } },
        });
        if (toActivate.length) logger.info(`Beat Battle lifecycle: ${toActivate.length} battle(s) to activate`);

        for (const battle of toActivate) {
            try {
                logger.info(`Beat Battle lifecycle: activating "${battle.title}"`);
                const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });

                let submissionChannelId = battle.submissionChannelId;
                if (!submissionChannelId) {
                    try {
                        const channelName = `submissions-${battle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
                        const categoryId = battle.categoryId || settings?.submissionCategoryId || settings?.battleCategoryId || undefined;
                        const body: any = {
                            name: channelName,
                            type: 0,
                            topic: `Submit your beats for: ${battle.title}`,
                            rate_limit_per_user: 10,
                            permission_overwrites: [
                                { id: battle.guildId, type: 0, allow: '101376', deny: '0' },
                            ],
                        };
                        if (categoryId) body.parent_id = categoryId;

                        const chRes = await discordReq('POST', `/guilds/${battle.guildId}/channels`, body);
                        submissionChannelId = chRes.data.id;

                        const instrEmbed = {
                            title: `🎵 ${battle.title} — Submissions Open!`,
                            description: 'Drop your audio file (MP3/WAV) in this channel to submit.\n\nOne entry per person. Good luck!',
                            color: 0x2B8C71,
                            footer: { text: 'Fuji Studio Beat Battle' },
                            timestamp: new Date().toISOString(),
                        };
                        await discordReq('POST', `/channels/${submissionChannelId}/messages`, { embeds: [instrEmbed] });
                    } catch (err: any) {
                        logger.error(`Beat Battle lifecycle: failed to create submissions channel for "${battle.title}": ${err.message}`);
                    }
                }

                await db.beatBattle.update({
                    where: { id: battle.id },
                    data: { status: 'active', submissionChannelId },
                });

                const updatedBattle = { ...battle, status: 'active', submissionChannelId };
                await postBattleAnnouncement(updatedBattle, settings);
            } catch (err: any) {
                logger.error(`Beat Battle lifecycle: failed to activate "${battle.title}": ${err.message}`);
            }
        }

        // ---------- 2. Active battles still missing a submissions channel ----------
        const noChannel = await db.beatBattle.findMany({
            where: { status: 'active', submissionChannelId: null },
        });
        for (const battle of noChannel) {
            try {
                logger.info(`Beat Battle lifecycle: creating missing channel for active battle "${battle.title}"`);
                const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
                const channelName = `submissions-${battle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
                const categoryId = battle.categoryId || settings?.submissionCategoryId || settings?.battleCategoryId || undefined;
                const body: any = {
                    name: channelName,
                    type: 0,
                    topic: `Submit your beats for: ${battle.title}`,
                    rate_limit_per_user: 10,
                    permission_overwrites: [
                        { id: battle.guildId, type: 0, allow: '101376', deny: '0' },
                    ],
                };
                if (categoryId) body.parent_id = categoryId;
                const chRes = await discordReq('POST', `/guilds/${battle.guildId}/channels`, body);
                const channelId = chRes.data.id;
                const instrEmbed = {
                    title: `🎵 ${battle.title} — Submissions Open!`,
                    description: 'Drop your audio file (MP3/WAV) in this channel to submit.\n\nOne entry per person. Good luck!',
                    color: 0x2B8C71,
                    footer: { text: 'Fuji Studio Beat Battle' },
                    timestamp: new Date().toISOString(),
                };
                await discordReq('POST', `/channels/${channelId}/messages`, { embeds: [instrEmbed] });
                await db.beatBattle.update({ where: { id: battle.id }, data: { submissionChannelId: channelId } });
            } catch (err: any) {
                logger.error(`Beat Battle lifecycle: failed to create channel for "${battle.title}": ${err.message}`);
            }
        }

        // ---------- 3. Active → Voting (submissionEnd passed) ----------
        const toVoting = await db.beatBattle.findMany({
            where: { status: 'active', submissionEnd: { not: null, lte: now } },
        });
        if (toVoting.length) logger.info(`Beat Battle lifecycle: ${toVoting.length} battle(s) moving to voting`);

        for (const battle of toVoting) {
            try {
                logger.info(`Beat Battle lifecycle: "${battle.title}" → voting`);
                await db.beatBattle.update({ where: { id: battle.id }, data: { status: 'voting' } });

                // Lock submissions channel — deny SEND_MESSAGES + ATTACH_FILES for @everyone
                if (battle.submissionChannelId) {
                    try {
                        await discordReq('PUT', `/channels/${battle.submissionChannelId}/permissions/${battle.guildId}`, {
                            type: 0,
                            allow: '66560',  // VIEW_CHANNEL(1024) + READ_MESSAGE_HISTORY(65536)
                            deny: '34816',   // SEND_MESSAGES(2048) + ATTACH_FILES(32768)
                        });

                        const entryCount = await db.battleEntry.count({ where: { battleId: battle.id } });
                        await discordReq('POST', `/channels/${battle.submissionChannelId}/messages`, {
                            embeds: [{
                                title: '🔒 Submissions Closed',
                                description: `Submissions for **${battle.title}** are now closed.\n\n**${entryCount}** ${entryCount === 1 ? 'entry' : 'entries'} received. Voting is now open — hit the 🔥 button on your favorite beat!`,
                                color: 0xFFA500,
                                footer: { text: 'Fuji Studio Beat Battle' },
                                timestamp: new Date().toISOString(),
                            }],
                        });

                        // Add vote buttons to all existing entry embeds
                        const entries = await db.battleEntry.findMany({
                            where: { battleId: battle.id, discordMsgId: { not: null } },
                        });
                        for (const entry of entries) {
                            try {
                                await discordReq('PATCH', `/channels/${battle.submissionChannelId}/messages/${entry.discordMsgId}`, {
                                    components: [{
                                        type: 1,
                                        components: [{
                                            type: 2, style: 1, custom_id: `battle_vote_${entry.id}`,
                                            label: `Vote (${entry.voteCount})`, emoji: { name: '🔥' },
                                        }],
                                    }],
                                });
                            } catch {}
                        }
                        logger.info(`Beat Battle lifecycle: added vote buttons to ${entries.length} entries for "${battle.title}"`);
                    } catch (err: any) {
                        logger.error(`Beat Battle lifecycle: failed to lock channel for "${battle.title}": ${err.message}`);
                    }
                }

                // Announce voting phase
                const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
                await postBattleAnnouncement({ ...battle, status: 'voting' }, settings);
            } catch (err: any) {
                logger.error(`Beat Battle lifecycle: failed to transition "${battle.title}" to voting: ${err.message}`);
            }
        }

        // ---------- 4. Voting → Completed (votingEnd passed) ----------
        const toComplete = await db.beatBattle.findMany({
            where: { status: 'voting', votingEnd: { not: null, lte: now } },
            include: { entries: { orderBy: { voteCount: 'desc' }, take: 1 } },
        });
        if (toComplete.length) logger.info(`Beat Battle lifecycle: ${toComplete.length} battle(s) completing`);

        for (const battle of toComplete) {
            try {
                logger.info(`Beat Battle lifecycle: completing "${battle.title}"`);
                const winner = (battle as any).entries?.[0];
                await db.beatBattle.update({
                    where: { id: battle.id },
                    data: { status: 'completed', winnerEntryId: winner?.id || null },
                });

                const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
                await postBattleAnnouncement({ ...battle, status: 'completed', winnerEntryId: winner?.id || null }, settings);

                // Post winner in submissions channel
                if (battle.submissionChannelId && winner) {
                    try {
                        await discordReq('POST', `/channels/${battle.submissionChannelId}/messages`, {
                            embeds: [{
                                title: `🏆 ${battle.title} — Winner!`,
                                description: `Congratulations to <@${winner.userId}>!\n\n**"${winner.trackTitle}"** with **${winner.voteCount}** votes!`,
                                color: 0xFFD700,
                                footer: { text: 'Fuji Studio Beat Battle' },
                                timestamp: new Date().toISOString(),
                            }],
                        });
                    } catch (err: any) {
                        logger.error(`Beat Battle lifecycle: failed to post winner in channel: ${err.message}`);
                    }
                }

                // Archive submissions channel to archive category
                if (battle.submissionChannelId && settings?.archiveCategoryId) {
                    try {
                        await discordReq('PATCH', `/channels/${battle.submissionChannelId}`, {
                            parent_id: settings.archiveCategoryId,
                            name: `archived-${battle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 25)}`,
                        });
                    } catch (err: any) {
                        logger.error(`Beat Battle lifecycle: failed to archive channel: ${err.message}`);
                    }
                }
            } catch (err: any) {
                logger.error(`Beat Battle lifecycle: failed to complete "${battle.title}": ${err.message}`);
            }
        }
    } catch (err: any) {
        logger.error(`Beat Battle lifecycle error: ${err.message}`);
    }
}

// Run lifecycle immediately on start, then every 60 seconds
runBeatBattleLifecycle();
setInterval(runBeatBattleLifecycle, 60_000);

app.listen(PORT, () => {
  logger.info(`API server running on port ${PORT}`);
  if (!R2Storage.isConfigured()) {
    logger.warn('R2 not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME missing). ZIP sample audio will be served from local storage.');
  }
});
