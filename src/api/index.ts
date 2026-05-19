
import 'dotenv/config';
import express from 'express';
import type { RequestHandler } from 'express';
import compression from 'compression';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
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
import { ChartService } from '../services/ChartService.js';
import * as mm from 'music-metadata';
import { FLPParser } from '../bot/utils/FLPParser.js';
import { AlsParser } from '../services/AlsParser.js';
import { MediaConverter } from '../services/MediaConverter.js';
import { ProjectZipProcessor } from '../services/ProjectZipProcessor.js';
import { R2Storage } from '../services/R2Storage.js';
import { runBackup, pgDump } from '../services/DatabaseBackup.js';
import { softDeleteMiddleware } from '../services/softDelete.js';
import { retryMiddleware } from '../services/prismaRetry.js';
import { WaveformExtractor } from '../services/WaveformExtractor.js';
import { FileValidator, sanitizeFilename, sanitizeDisplayName } from '../services/FileValidator.js';
import { MessageEncryption } from '../services/MessageEncryption.js';
import AdmZip from 'adm-zip';
import * as otplibAll from 'otplib';
const generateSecret = otplibAll.generateSecret;
const verifySync = otplibAll.verifySync;
const generateURI = otplibAll.generateURI;
import QRCode from 'qrcode';

// Augment express-session to include custom fields
declare module 'express-session' {
    interface SessionData {
        user?: any;
        isGuildMember?: boolean;
        mutualAdminGuilds?: any[];
        mutualStaffGuilds?: any[];
        guilds?: any[];
        _discordLinkToken?: string;
        _discordLinkReturn?: string;
    }
}

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
    
    if (file.fieldname === 'artwork' || file.fieldname === 'cover') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/artwork');
    } else if (file.fieldname === 'avatar') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/avatars');
    } else if (file.fieldname === 'project') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/projects');
    } else if (file.fieldname === 'sponsorLogo') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/sponsors');
    } else if (file.fieldname === 'battleBanner' || file.fieldname === 'battleCardImage') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/battle-banners');
    } else if (file.fieldname === 'embedImage') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/embed-images');
    } else if (file.fieldname === 'articleImage' || file.fieldname === 'articleCover') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/articles');
    } else if (file.fieldname === 'articleAudio') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/articles/audio');
    } else if (file.fieldname === 'articleProject') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/articles/projects');
    } else if (file.fieldname === 'articlePreset') {
      dir = path.join(PROJECT_ROOT, 'public/uploads/articles/presets');
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
    fileSize: 500 * 1024 * 1024 // 500MB — accommodates large ZIP loop/sample packs
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a', '.wma', '.aiff', '.aif', '.opus', '.webm'];
      const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
      if (file.mimetype.startsWith('audio/') || audioExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed for the track!'));
      }
    } else if (file.fieldname === 'artwork' || file.fieldname === 'cover' || file.fieldname === 'avatar' || file.fieldname === 'sponsorLogo' || file.fieldname === 'battleBanner' || file.fieldname === 'embedImage' || file.fieldname === 'articleImage' || file.fieldname === 'articleCover') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error(`Only image files are allowed for ${file.fieldname}!`));
      }
    } else if (file.fieldname === 'project') {
      // Accept .flp, .als, or .zip (project + samples bundle)
      const projExt = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
      if (['.flp', '.als', '.zip'].includes(projExt) ||
          file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
        cb(null, true);
      } else {
        cb(new Error('Only project files (.flp, .als) or .zip bundles are allowed!'));
      }
    } else if (file.fieldname === 'articleAudio') {
      const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a', '.aiff', '.aif'];
      const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
      if (file.mimetype.startsWith('audio/') || audioExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed!'));
      }
    } else if (file.fieldname === 'articleProject') {
      const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
      if (['.flp', '.zip', '.als', '.logicx'].includes(ext) || file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
        cb(null, true);
      } else {
        cb(new Error('Only project files (.flp, .zip, .als) are allowed!'));
      }
    } else if (file.fieldname === 'articlePreset') {
      const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
      const presetExts = ['.fst', '.fxp', '.fxb', '.nmsv', '.vstpreset', '.adv', '.adg', '.aupreset', '.wav', '.zip', '.rar', '.7z'];
      if (presetExts.includes(ext) || file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || file.mimetype === 'application/octet-stream') {
        cb(null, true);
      } else {
        cb(new Error('Only preset files (.fst, .fxp, .nmsv, .vstpreset, .zip, etc.) are allowed!'));
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
 * Generate a URL-safe slug from a track title.
 * Falls back to a short timestamp-based ID when the title is entirely
 * non-ASCII (e.g. CJK, symbol-only) so slugs are never empty strings.
 */
function safeTrackSlug(title: string): string {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return base || `track-${Date.now()}`;
}

// ── Virus scanning (ClamAV via clamdscan daemon) ─────────────────────────────
let _clamScanner: any = null;
let _clamAvailable = true; // set false after first failed init so we stop retrying

async function _getClamScanner() {
    if (!_clamAvailable) return null;
    if (_clamScanner) return _clamScanner;
    try {
        const NodeClam = (await import('clamscan')).default;
        // Use the clamav-daemon socket for near-instant scans.
        // The daemon keeps virus definitions in memory, avoiding the 30-60s
        // cold-start penalty of the standalone clamscan binary.
        _clamScanner = await new NodeClam().init({
            removeInfected: false,
            debugMode: false,
            clamdscan: {
                active: true,
                socket: '/var/run/clamav/clamd.ctl',
                timeout: 5000,
            },
            clamscan: { active: false },
        });
        logger.info('ClamAV virus scanner ready (clamdscan daemon)');
        return _clamScanner;
    } catch (e: any) {
        _clamAvailable = false;
        logger.warn(`ClamAV unavailable \u2014 uploads will proceed without virus scanning: ${e.message}`);
        return null;
    }
}

async function scanFileForViruses(filePath: string, fieldName?: string): Promise<void> {
    const scanner = await _getClamScanner();
    if (!scanner) return; // gracefully skip if ClamAV not installed
    try {
        const { isInfected, viruses } = await scanner.scanFile(filePath);
        if (isInfected) {
            try { fs.unlinkSync(filePath); } catch {}
            const detected = Array.isArray(viruses) ? viruses.join(', ') : String(viruses);
            logger.warn(`Virus detected in upload${fieldName ? ` (${fieldName})` : ''}: ${detected}`);
            throw new Error(`Uploaded file was rejected: virus detected (${detected})`);
        }
    } catch (e: any) {
        if (e.message?.startsWith('Uploaded file was rejected')) throw e;
        logger.warn(`Virus scan error for ${path.basename(filePath)}: ${e.message}`);
    }
}
// ────────────────────────────────────────────────────────────────────────────

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
 * Safe to call with null/undefined or Discord/external URLs \u2014 no-ops in those cases.
 */
async function deleteFromStorage(url: string | null | undefined): Promise<void> {
    if (!url) return;
    if (url.startsWith(CDN_BASE + '/')) {
        const key = url.slice(CDN_BASE.length + 1);
        await R2Storage.deleteObject(key);
    } else if (url.startsWith('/uploads/')) {
        const filePath = path.resolve(PROJECT_ROOT, 'public', url.slice(1));
        const publicDir = path.resolve(PROJECT_ROOT, 'public');
        if (!filePath.startsWith(publicDir + path.sep)) return; // Block path traversal
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }
}

// --- Discord API Helper with Cache and Rate Limit Handling ---

// --- Email HTML wrapper -------------------------------------------------------
// All email clients need a proper <!DOCTYPE> + <meta charset="UTF-8"> or they
// default to Latin-1, turning emojis and special chars into Mojibake.
const wrapEmailHtml = (content: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="margin:0;padding:16px;background:#0f1117;">
${content}
</body>
</html>`;

// --- API Response Cache ---
// Generic in-memory cache for expensive API responses
const apiResponseCache = new Map<string, { data: any, timestamp: number }>();
const API_CACHE_TTL: Record<string, number> = {
    'discovery-settings': 1000 * 60 * 5,   // 5 minutes
    'discovery-tracks':  1000 * 60 * 5,     // 5 minutes
    'musician-profiles': 1000 * 60 * 5,     // 5 minutes
    'popular-playlists': 1000 * 60 * 3,     // 3 minutes
    'leaderboards-tracks': 1000 * 60 * 5,   // 5 minutes
    'leaderboards-artists': 1000 * 60 * 5,   // 5 minutes
    'charts-daily': 1000 * 60 * 5,          // 5 minutes
    'charts-weekly': 1000 * 60 * 10,        // 10 minutes
    'charts-alltime': 1000 * 60 * 15,       // 15 minutes
    'battles-list': 1000 * 60 * 2,          // 2 minutes
    'genres': 1000 * 60 * 30,               // 30 minutes
    // Individual profile pages \u2014 safe to cache for 5 minutes
    'profile': 1000 * 60 * 5,              // 5 minutes (prefix-matched below)
};

function getCachedResponse(key: string): any | null {
    const entry = apiResponseCache.get(key);
    // Support prefix-based TTL (e.g. all "profile-*" keys share one TTL entry)
    const ttlKey = API_CACHE_TTL[key] ? key : Object.keys(API_CACHE_TTL).find(k => key.startsWith(k + '-'));
    const ttl = ttlKey ? API_CACHE_TTL[ttlKey] : 60000;
    if (entry && (Date.now() - entry.timestamp < ttl)) {
        return entry.data;
    }
    return null;
}

function setCachedResponse(key: string, data: any): void {
    apiResponseCache.set(key, { data, timestamp: Date.now() });
}

// Bust all cache entries that depend on a user's track list.
// Must be called after any track create / update / delete.
function invalidateProfileCache(userId: string): void {
    apiResponseCache.delete(`profile-${userId.toLowerCase()}`);
    // Also bust the all-profiles list (discovery/leaderboard pages)
    apiResponseCache.delete('musician-profiles');
}

// --- Cloudflare Edge Cache Middleware ---
// Adds Cache-Control headers to public GET endpoints so Cloudflare caches them at edge.
// Only applied to unauthenticated, read-only routes.
function publicCache(maxAgeSeconds: number) {
    return (_req: any, res: any, next: any) => {
        res.set('Cache-Control', `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=60`);
        next();
    };
}

/**
 * Downsample a waveformPeaks array to targetLength points by averaging buckets.
 * Used to reduce the profile track listing payload (~200pts → 60pts) while
 * keeping the full resolution available on the individual track page.
 */
function downsamplePeaks(peaks: number[], targetLength = 60): number[] {
    if (!peaks || peaks.length <= targetLength) return peaks;
    const result: number[] = [];
    const bucketSize = peaks.length / targetLength;
    for (let i = 0; i < targetLength; i++) {
        const start = Math.floor(i * bucketSize);
        const end = Math.min(Math.floor((i + 1) * bucketSize), peaks.length);
        const slice = peaks.slice(start, end);
        result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
    return result;
}


// guildId -> { channels: { data: any, timestamp: number }, roles: { data: any, timestamp: number } }
// Cache member roles: guildId:userId -> { roles, timestamp }
const memberRoleCache = new Map<string, { roles: string[], timestamp: number }>();
const MEMBER_ROLE_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// Cache for plugin settings to avoid repeated DB lookups in checkPluginAccess
const pluginSettingsCache = new Map<string, { data: any, timestamp: number }>();
const PLUGIN_SETTINGS_CACHE_TTL = 1000 * 60 * 2; // 2 minutes

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
// Extend DATABASE_URL with larger connection pool (default of 3 connections causes pool exhaustion
// under concurrent requests \u2014 each slow track query holds a connection for seconds)
const _dbUrl = (() => {
    const raw = process.env.DATABASE_URL || '';
    try {
        const u = new URL(raw);
        u.searchParams.set('connection_limit', '10');
        u.searchParams.set('pool_timeout', '30');
        return u.toString();
    } catch { return raw; }
})();
export const db = globalForPrisma.prisma || new PrismaClient({
  datasourceUrl: _dbUrl,
  log: process.env.NODE_ENV !== 'production'
    ? [
        { emit: 'event', level: 'query' },  // enable query timing in dev/staging
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ]
    : ['error', 'warn'],
});
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
  // Log every query with its duration \u2014 use this to spot slow queries and N+1s
  (db as any).$on('query', (e: any) => {
    if (e.duration > 50) { // only log queries taking >50ms
      console.warn(`[Prisma SLOW] ${e.duration}ms \u2014 ${e.query.substring(0, 120)}`);
    }
  });
}

// Register retry middleware (retries transient DB errors with exponential backoff)
db.$use(retryMiddleware);
// Register soft-delete middleware (converts delete?update, auto-filters deletedAt)
db.$use(softDeleteMiddleware);

const emailService = new EmailService();
const profileService = new ProfileService(db);
const audioService = new AudioService(db);
const chartService = new ChartService(db);


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

// Static files for uploads - Tracks & Projects require auth; images are public
const uploadsPath = path.join(PROJECT_ROOT, 'public', 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
console.log(`[Uploads] Serving static files from: ${uploadsPath}`);
app.use('/uploads', (req, res, next) => {
    // Gate tracks and projects behind authentication
    const protectedPaths = ['/tracks/', '/projects/'];
    const isProtected = protectedPaths.some(p => req.path.startsWith(p));
    if (isProtected && !req.session?.user) {
        return res.status(401).json({ error: 'Authentication required to access this file.' });
    }

    // Security headers for user-uploaded content
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', isProtected ? 'private, no-cache' : 'public, max-age=86400');
    next();
}, express.static(uploadsPath));

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
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

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
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

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
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
        
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
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

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
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://static.cloudflareinsights.com', // Cloudflare Web Analytics
            ],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            mediaSrc: ["'self'", 'blob:', 'https:'],
            connectSrc: [
                "'self'",
                'https:',
                'https://cloudflareinsights.com', // Cloudflare analytics beacon
            ],
            fontSrc: ["'self'", 'https:', 'data:'],
        },
    },
    // Disabled: breaks SharedArrayBuffer used by audio worklets
    crossOriginEmbedderPolicy: false,
}));
// Compress all responses >1KB (gzip) \u2014 critical for large JSON payloads (waveforms, track listings)
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Explicitly stamp charset=utf-8 on every JSON response so no proxy or client
// can infer Latin-1 and corrupt emojis / special characters.
app.use((_req, res, next) => {
    const _origJson = res.json.bind(res);
    res.json = function (body: any) {
        this.setHeader('Content-Type', 'application/json; charset=utf-8');
        return _origJson(body);
    };
    next();
});
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}
// Trust the first reverse-proxy hop (nginx/Cloudflare) so req.secure works
// correctly for cookie.secure in production.
app.set('trust proxy', 1);

const PgSession = connectPgSimple(session);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 60, // prune expired rows hourly
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Only require HTTPS in production — allows local HTTP dev without constant logouts
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  }
}));

// --- Rate Limiting ---
// ipKeyGenerator(ip) normalises IPv6 addresses. Wrap it in a request adapter so
// express-rate-limit's static analysis sees the helper being used (prevents
// ERR_ERL_KEY_GEN_IPV6 at startup). Trust proxy is already set on the app.
const ipFromReq = (req: any): string => ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? '');
const rlKey = (req: any): string => req.session?.user?.id || ipFromReq(req);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipFromReq,
    message: { error: 'Too many authentication attempts, please try again later.' },
});
// Write-only limiter -- only counts POST/PUT/PATCH/DELETE so GETs (page loads) are never blocked
const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rlKey,
    skip: (req: any) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
    message: { error: 'You are doing that too fast. Please wait a moment before trying again.' },
});
// Strict limiter for track uploads -- prevents spam and large-file abuse
const uploadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10-minute window
    max: 5,                    // 5 uploads per window per user
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rlKey,
    message: { error: 'Upload limit reached. You can upload up to 5 tracks every 10 minutes. Please wait before trying again.' },
});
app.use('/api/auth', authLimiter);
app.use('/api/', writeLimiter);

// Register-style limiter for non-track uploads (avatars, covers, battle submissions)
const generalUploadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10-minute window
    max: 10,                   // 10 uploads per window per user
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rlKey,
    message: { error: 'Upload limit reached. Please wait before uploading again.' },
});
// --- Invite-Only Global Guard ---
// Gate disabled: site is publicly launched. INVITE_ONLY env var is ignored.
app.use('/api/', (req, res, next) => {
    return next(); // public launch — no invite gate
    if (process.env.INVITE_ONLY !== 'true') return next();
    const path = req.path;
    // Always allow auth routes, webhook endpoints, beta status check, and the admin dashboard config endpoints
    if (path.startsWith('/auth/') ||
        path.startsWith('/email/webhook') ||
        path.startsWith('/beta/') ||
        path.startsWith('/admin/') ||
        path.startsWith('/guilds/') ||
        path.startsWith('/dashboard/') ||
        path.startsWith('/plugins/') ||
        path.startsWith('/bot/') ||
        path.startsWith('/email/') || 
        path.startsWith('/guilds/') ||
        path.startsWith('/moderation/') ||
        path.startsWith('/ticket') ||
        path.startsWith('/feedback/') ||
        path.startsWith('/channel-rules/') ||
        path.startsWith('/leveling/') ||
        path.startsWith('/bot-messenger/') ||
        path.startsWith('/studio-guide/') ||
        // Public-facing discovery pages (no auth required)
        path.startsWith('/discovery/') ||
        path.startsWith('/musician/') ||
        path.startsWith('/charts/') ||
        path.startsWith('/playlists/popular') ||
        path.startsWith('/beat-battle/battles')) {
        return next();
    }
    // Admins and staff always pass
    if ((req.session.mutualAdminGuilds as any)?.length || (req.session.mutualStaffGuilds as any)?.length) return next();
    if (req.session.user?._role === 'admin') return next();
    // Must be authenticated AND invited
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.session.user._invited) {
        return res.status(403).json({ error: 'invite_required', message: 'This feature is available to invited users only.' });
    }
    next();
});

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
    // Allow admins and staff with dashboard access
    if (!(req.session.mutualAdminGuilds as any)?.length && !(req.session.mutualStaffGuilds as any)?.length) {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
};

// Invite-only middleware: blocks non-invited users on public frontend routes
// Admin/dashboard routes are exempt (they use requireAdmin)
const requireInvited: RequestHandler = (req, res, next) => {
    // Public launch — gate disabled, let everyone through
    return next();
    if (process.env.INVITE_ONLY !== 'true') return next();
    // Not logged in � block
    if (!req.session.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    // Admins and staff always pass
    if ((req.session.mutualAdminGuilds as any)?.length || (req.session.mutualStaffGuilds as any)?.length) return next();
    if (req.session.user._role === 'admin') return next();
    // Check invited flag
    if (!req.session.user._invited) {
        res.status(403).json({ error: 'invite_required', message: 'This feature is available to invited users only.' });
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

// Lightweight Discord OAuth for the appeal/support page — no account creation, no DB.
app.get('/api/auth/appeal/login', (req, res) => {
  const state = 'appeal_' + crypto.randomBytes(32).toString('hex');
  (req.session as any)._oauthState = state;
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state,
  });
  req.session.save(() => {
    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
  });
});

// Discord OAuth2 endpoints
app.get('/api/auth/discord/login', (req, res) => {
  // SEC-04: Generate state param to prevent CSRF on OAuth login
  const state = crypto.randomBytes(32).toString('hex');
  (req.session as any)._oauthState = state;
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds email',
    prompt: 'none',
    state,
  });
  logger.info(`[Auth] Redirecting to Discord with redirect_uri: ${DISCORD_REDIRECT_URI}`);
  req.session.save(() => {
    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
  });
});


// Discord OAuth2 callback: store user, all user guilds, and mutual admin guilds
app.get('/api/auth/discord/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string | undefined;
  if (!code) return res.status(400).send('No code provided');
  // SEC-04: Verify OAuth state to prevent CSRF
  // Link flows use state=link_<token> and are verified separately below.
  // Appeal flows use state=appeal_<token> — same CSRF check, but handled separately after token exchange.
  const isLinkFlow = state && state.startsWith('link_');
  const isAppealFlow = state && state.startsWith('appeal_');
  if (!isLinkFlow) {
    if (!state || state !== (req.session as any)?._oauthState) {
      return res.status(403).send('Invalid OAuth state - please try logging in again.');
    }
    delete (req.session as any)._oauthState;
  }
  try {
    // Exchange code for token — appeal flow only needs 'identify' scope
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
      scope: isAppealFlow ? 'identify' : 'identify guilds email',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const { access_token, token_type } = tokenRes.data;
    // Get user info
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `${token_type} ${access_token}` }
    });
    const user = userRes.data;

    // ===== APPEAL / SUPPORT FLOW =====
    // No account creation, no guilds lookup — just set Discord identity in session.
    if (isAppealFlow) {
      req.session.user = {
        id: user.id,
        username: user.username || `user_${user.id}`,
        global_name: user.global_name || null,
        avatar: user.avatar || null,
        discriminator: user.discriminator || '0',
        _loginMethod: 'discord',
        _appealSession: true,
      } as any;
      return req.session.save((err) => {
        if (err) logger.error('[Auth] Session save error during appeal login', err);
        res.redirect(`${process.env.DASHBOARD_ORIGIN || ''}/appeal`);
      });
    }

    // Get user guilds (regular + link flows only)
    const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `${token_type} ${access_token}` }
    });
    const userGuilds = guildsRes.data;
    // Get bot guilds from DB
    const botGuilds = await getBotGuildIds();
    
    // Find mutual guilds where user is admin/owner OR has allowed role
    const mutualAdminGuilds: any[] = [];  // Real admins (owner or ADMINISTRATOR permission)
    const mutualStaffGuilds: any[] = [];  // Role-based dashboard access (not full admins)
    const botGuildIdSet = new Set(botGuilds.map((bg: any) => bg.id));
    const candidateGuilds = userGuilds.filter((g: any) => botGuildIdSet.has(g.id));

    // Separate admin guilds from guilds needing role checks
    const roleCheckGuilds: any[] = [];

    for (const guild of candidateGuilds) {
        const permissions = BigInt(guild.permissions);
        const isAdmin = guild.owner || (permissions & BigInt(0x8)) === BigInt(0x8);
        if (isAdmin) {
            mutualAdminGuilds.push(guild);
        } else {
            roleCheckGuilds.push(guild);
        }
    }

    // Check role access for non-admin guilds in parallel (these are staff, NOT admins)
    if (roleCheckGuilds.length > 0) {
        const roleCheckResults = await Promise.all(roleCheckGuilds.map(async (guild) => {
            try {
                const access = await db.dashboardAccess.findUnique({ where: { guildId: guild.id } });
                if (access && access.allowedRoles.length > 0) {
                    const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guild.id}/members/${user.id}`, {
                        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                        timeout: 5000
                    });
                    const memberRoles = memberRes.data.roles || [];
                    // Populate memberRoleCache for later use by checkPluginAccess
                    memberRoleCache.set(`${guild.id}:${user.id}`, { roles: memberRoles, timestamp: Date.now() });
                    const hasRole = memberRoles.some((r: string) => access.allowedRoles.includes(r));
                    if (hasRole) return guild;
                }
            } catch (e) {
                // Ignore fetch errors
            }
            return null;
        }));
        mutualStaffGuilds.push(...roleCheckResults.filter(Boolean));
    }

    // ===== DISCORD LINKING FLOW =====
    // If state=link_<token>, this is a linking request from a logged-in user
    if (state && state.startsWith('link_') && req.session?.user?._localId) {
        const linkToken = state.slice(5);
        const returnTo = req.session._discordLinkReturn || '/account';
        if (linkToken !== req.session._discordLinkToken) {
            return res.redirect(`${process.env.DASHBOARD_ORIGIN || ''}${returnTo}?linkError=invalid_token`);
        }
        delete req.session._discordLinkToken;
        delete req.session._discordLinkReturn;

        // Check if this Discord account is already linked to another user
        const existingDiscordUser = await db.user.findUnique({ where: { discordId: user.id } });
        if (existingDiscordUser && existingDiscordUser.id !== req.session.user._localId) {
            return res.redirect(`${process.env.DASHBOARD_ORIGIN || ''}${returnTo}?linkError=already_linked`);
        }

        // Link Discord to current user
        try {
            const dbUser = await db.user.update({
                where: { id: req.session.user._localId },
                data: {
                    discordId: user.id,
                    avatar: user.avatar,
                    displayName: user.global_name || user.username,
                },
            });

            // Update session with Discord data
            req.session.user.id = user.id;
            req.session.user.avatar = user.avatar;
            req.session.user.global_name = user.global_name;
            req.session.user.discriminator = user.discriminator;
            req.session.guilds = userGuilds;
            req.session.mutualAdminGuilds = mutualAdminGuilds;
            req.session.mutualStaffGuilds = mutualStaffGuilds;

            const primaryGuildId = process.env.GUILD_ID;
            const isGuildMember = primaryGuildId ? userGuilds.some((g: any) => g.id === primaryGuildId) : false;
            req.session.isGuildMember = isGuildMember;

            // Auto-invite if user has a beta role in the primary guild
            if (isGuildMember && !req.session.user._invited && primaryGuildId) {
                try {
                    const rows: any[] = await db.$queryRaw`SELECT "betaRoleIds" FROM "dashboard_access" WHERE "guildId" = ${primaryGuildId} LIMIT 1`;
                    const betaRoleIds: string[] = rows[0]?.betaRoleIds || [];
                    if (betaRoleIds.length > 0) {
                        const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${primaryGuildId}/members/${user.id}`, {
                            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                            timeout: 5000
                        });
                        const memberRoles: string[] = memberRes.data.roles || [];
                        memberRoleCache.set(`${primaryGuildId}:${user.id}`, { roles: memberRoles, timestamp: Date.now() });
                        if (memberRoles.some((r: string) => betaRoleIds.includes(r))) {
                            await db.user.update({ where: { id: req.session.user._localId }, data: { invited: true } });
                            req.session.user._invited = true;
                            logger.info(`[Auth] Auto-invited user ${user.username} (${user.id}) via Discord link � has beta role`);
                        }
                    }
                } catch (e) {
                    logger.warn(`[Auth] Failed to check beta roles during Discord link for ${user.id}`, e);
                }
            }

            req.session.save((err) => {
                if (err) logger.error('[Auth] Session save error during Discord link', err);
                res.redirect(`${process.env.DASHBOARD_ORIGIN || ''}${returnTo}?linked=true`);
            });
        } catch (e) {
            logger.error('[Auth] Failed to link Discord account', e);
            res.redirect(`${process.env.DASHBOARD_ORIGIN || ''}${returnTo}?linkError=failed`);
        }
        return;
    }

    // ===== STANDARD DISCORD LOGIN FLOW =====
    // If no account exists for this Discord user, auto-create one.
    try {
        let dbUser = await db.user.findUnique({ where: { discordId: user.id } });

        // If not found via the normal (non-deleted) lookup, check whether a soft-deleted
        // account with this discordId exists. If so, reactivate it instead of creating a
        // duplicate — this is the root cause of double-account spam after admin deletions.
        if (!dbUser) {
            const deletedUser = await db.user.findFirst({
                where: { discordId: user.id, deletedAt: { not: null } },
            });
            if (deletedUser) {
                dbUser = await db.user.update({
                    where: { id: deletedUser.id },
                    data: { deletedAt: null, lastLoginAt: new Date(), avatar: user.avatar, displayName: user.global_name || user.username },
                });
                logger.info(`[Auth] Reactivated soft-deleted account ${deletedUser.id} for Discord user ${user.id}`);
            }
        }

        if (!dbUser) {
            // Auto-create account from Discord profile
            const discordUsername = (user.username || `user_${user.id}`).toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30);

            // Ensure username is unique
            let finalUsername = discordUsername;
            const existingUsername = await db.user.findUnique({ where: { username: finalUsername } });
            if (existingUsername) {
                finalUsername = `${discordUsername.slice(0, 25)}_${user.id.slice(-4)}`;
            }

            // Check if Discord email already belongs to a local account
            let emailToUse = user.email || null;
            if (emailToUse) {
                const emailOwner = await db.user.findUnique({ where: { email: emailToUse } });
                if (emailOwner) {
                    // Link Discord to existing account that shares this email
                    dbUser = await db.user.update({
                        where: { id: emailOwner.id },
                        data: {
                            discordId: user.id,
                            displayName: user.global_name || user.username,
                            avatar: user.avatar,
                            lastLoginAt: new Date(),
                        },
                    });
                    logger.info(`[Auth] Linked Discord ${user.id} to existing email account ${emailOwner.id} (${emailToUse})`);
                }
            }

            if (!dbUser) {
                // No existing account found — do NOT auto-create.
                // Discord is for login/linking only; new accounts must be registered via email.
                logger.info(`[Auth] Discord login rejected for ${user.username} (${user.id}): no matching Fuji Studio account`);
                return res.redirect(`${process.env.DASHBOARD_ORIGIN || ''}/login?error=discord_no_account`);
            }
        } else {
            await db.user.update({
                where: { id: dbUser.id },
                data: {
                    displayName: user.global_name || user.username,
                    avatar: user.avatar,
                    lastLoginAt: new Date(),
                },
            });
        }
        user._localId = dbUser.id;
        user._hasPassword = !!dbUser.passwordHash;
        user._email = dbUser.email;
        user._emailVerified = !!dbUser.emailVerified;
        user._totpEnabled = !!dbUser.totpEnabled;
        user._loginMethod = 'discord';
        user._invited = !!dbUser.invited;
        user._role = dbUser.role || 'user';
    } catch (e) {
        logger.warn('[Auth] Failed to find/update account during Discord login', e);
        return res.redirect(`${process.env.DASHBOARD_ORIGIN || ''}/login?error=server_error`);
    }

    req.session.user = user;
    req.session.guilds = userGuilds;
    req.session.mutualAdminGuilds = mutualAdminGuilds;
    req.session.mutualStaffGuilds = mutualStaffGuilds;

    // Check if user is a member of the primary community Discord server
    const primaryGuildId = process.env.GUILD_ID;
    let isGuildMember = false;
    if (primaryGuildId) {
      isGuildMember = userGuilds.some((g: any) => g.id === primaryGuildId);
    }
    req.session.isGuildMember = isGuildMember;

    // ===== ROLE-BASED BETA ACCESS =====
    // Auto-invite users who have specific Discord roles in the primary guild
    if (isGuildMember && !user._invited && primaryGuildId) {
        try {
            const rows: any[] = await db.$queryRaw`SELECT "betaRoleIds" FROM "dashboard_access" WHERE "guildId" = ${primaryGuildId} LIMIT 1`;
            const betaRoleIds: string[] = rows[0]?.betaRoleIds || [];
            if (betaRoleIds.length > 0) {
                const cacheKey = `${primaryGuildId}:${user.id}`;
                let memberRoles: string[];
                const cached = memberRoleCache.get(cacheKey);
                if (cached && (Date.now() - cached.timestamp < MEMBER_ROLE_CACHE_TTL)) {
                    memberRoles = cached.roles;
                } else {
                    const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${primaryGuildId}/members/${user.id}`, {
                        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                        timeout: 5000
                    });
                    memberRoles = memberRes.data.roles || [];
                    memberRoleCache.set(cacheKey, { roles: memberRoles, timestamp: Date.now() });
                }
                if (memberRoles.some((r: string) => betaRoleIds.includes(r))) {
                    await db.user.update({ where: { id: user._localId }, data: { invited: true } });
                    user._invited = true;
                    logger.info(`[Auth] Auto-invited user ${user.username} (${user.id}) � has beta role`);
                }
            }
        } catch (e) {
            logger.warn(`[Auth] Failed to check beta roles for ${user.id}`, e);
        }
    }

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
  res.json({ mutualAdminGuilds: req.session.mutualAdminGuilds || [], mutualStaffGuilds: req.session.mutualStaffGuilds || [] });
});

app.get('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect(process.env.DASHBOARD_ORIGIN || '/');
  });
});

// --- Password hashing (Node.js built-in crypto.scrypt) ---
async function hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
    const [salt, key] = hash.split(':');
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
        });
    });
}

// --- Session builder: creates a consistent session from a DB User ---
async function buildSessionFromUser(req: any, dbUser: any, loginMethod: 'email' | 'discord') {
    req.session.user = {
        id: dbUser.discordId || dbUser.id,
        username: dbUser.username,
        global_name: dbUser.displayName,
        avatar: dbUser.avatar,
        email: dbUser.email,
        _localId: dbUser.id,
        _hasPassword: !!dbUser.passwordHash,
        _email: dbUser.email,
        _emailVerified: !!dbUser.emailVerified,
        _loginMethod: loginMethod,
        _totpEnabled: !!dbUser.totpEnabled,
        _invited: !!dbUser.invited,
        _role: dbUser.role || 'user',
    };

    // If user has a linked Discord account, use bot token to resolve guild/admin status
    if (dbUser.discordId && loginMethod === 'email') {
        try {
            const botGuilds = await getBotGuildIds();
            const primaryGuildId = process.env.GUILD_ID;
            const mutualAdminGuilds: any[] = [];
            const mutualStaffGuilds: any[] = [];
            let isGuildMember = false;

            for (const botGuild of botGuilds) {
                try {
                    const [memberRes, guildRes, rolesRes] = await Promise.all([
                        axios.get(`https://discord.com/api/v10/guilds/${botGuild.id}/members/${dbUser.discordId}`,
                            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }, timeout: 5000 }),
                        axios.get(`https://discord.com/api/v10/guilds/${botGuild.id}`,
                            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }, timeout: 5000 }),
                        axios.get(`https://discord.com/api/v10/guilds/${botGuild.id}/roles`,
                            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }, timeout: 5000 }),
                    ]);

                    const member = memberRes.data;
                    const memberRoles: string[] = member.roles || [];

                    if (primaryGuildId && botGuild.id === primaryGuildId) isGuildMember = true;

                    // Store in cache for later permission checks
                    memberRoleCache.set(`${botGuild.id}:${dbUser.discordId}`, { roles: memberRoles, timestamp: Date.now() });

                    // Check ADMINISTRATOR permission (same logic as Discord OAuth flow)
                    const isOwner = guildRes.data.owner_id === dbUser.discordId;
                    const guildRoles: any[] = rolesRes.data;
                    const isDiscordAdmin = memberRoles.some((roleId: string) => {
                        const role = guildRoles.find((r: any) => r.id === roleId);
                        return role && (BigInt(role.permissions) & BigInt(0x8)) === BigInt(0x8);
                    });

                    if (isOwner || isDiscordAdmin) {
                        mutualAdminGuilds.push({ id: botGuild.id, name: botGuild.name, icon: botGuild.icon });
                    } else {
                        // Check dashboard-configured allowed roles (staff, not admin)
                        const guildAccess = await db.dashboardAccess.findUnique({ where: { guildId: botGuild.id } });
                        const hasAllowedRole = guildAccess?.allowedRoles?.length
                            ? memberRoles.some((r: string) => guildAccess.allowedRoles.includes(r))
                            : false;
                        if (hasAllowedRole) {
                            mutualStaffGuilds.push({ id: botGuild.id, name: botGuild.name, icon: botGuild.icon });
                        }
                    }
                } catch (e: any) {
                    // 404 = not a member of this guild, skip
                }
            }

            req.session.guilds = [];
            req.session.mutualAdminGuilds = mutualAdminGuilds;
            req.session.mutualStaffGuilds = mutualStaffGuilds;
            req.session.isGuildMember = isGuildMember;

            // Check beta role access for email-login users with linked Discord
            if (isGuildMember && !req.session.user._invited && primaryGuildId) {
                try {
                    const rows: any[] = await db.$queryRaw`SELECT "betaRoleIds" FROM "dashboard_access" WHERE "guildId" = ${primaryGuildId} LIMIT 1`;
                    const betaRoleIds: string[] = rows[0]?.betaRoleIds || [];
                    if (betaRoleIds.length > 0) {
                        const cacheKey = `${primaryGuildId}:${dbUser.discordId}`;
                        const cached = memberRoleCache.get(cacheKey);
                        if (cached && cached.roles.some((r: string) => betaRoleIds.includes(r))) {
                            await db.user.update({ where: { id: dbUser.id }, data: { invited: true } });
                            req.session.user._invited = true;
                        }
                    }
                } catch {
                    // Non-fatal
                }
            }
        } catch (e) {
            logger.warn('[Auth] Failed to resolve Discord guild status for email login', e);
            req.session.guilds = [];
            req.session.mutualAdminGuilds = [];
            req.session.mutualStaffGuilds = [];
            req.session.isGuildMember = false;
        }
        return;
    }

    // No Discord linked \u2014 no guild data
    req.session.guilds = [];
    req.session.mutualAdminGuilds = [];
    req.session.mutualStaffGuilds = [];
    req.session.isGuildMember = false;
}

// --- Username validation ---
function isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9_-]{3,30}$/.test(username);
}

// =============================================
// REGISTRATION
// =============================================
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyGenerator: ipFromReq, message: { error: 'Too many registration attempts. Try again later.' } });
app.post('/api/auth/register', registerLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }
        if (!isValidUsername(username)) {
            return res.status(400).json({ error: 'Username must be 3-30 characters and contain only letters, numbers, hyphens, and underscores' });
        }
        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        const emailNorm = String(email).toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        // Check uniqueness (include soft-deleted records to handle reactivation)
        const existing = await db.user.findFirst({
            where: {
                OR: [
                    { email: emailNorm },
                    { username: { equals: username, mode: 'insensitive' } },
                ]
            }
        });
        // Also check for soft-deleted records (the middleware filters them out)
        const softDeleted = await db.user.findFirst({
            where: {
                deletedAt: { not: null },
                OR: [
                    { email: emailNorm },
                    { username: { equals: username, mode: 'insensitive' } },
                ]
            }
        });
        if (existing) {
            // SEC-08: Generic message to prevent email/username enumeration
            return res.status(409).json({ error: 'An account with this email or username already exists' });
        }

        const passwordHash = await hashPassword(password);
        let dbUser;

        if (softDeleted && softDeleted.email === emailNorm) {
            // Reactivate the soft-deleted account with fresh credentials
            dbUser = await db.user.update({
                where: { id: softDeleted.id },
                data: {
                    username,
                    displayName: username,
                    passwordHash,
                    deletedAt: null,
                    lastLoginAt: new Date(),
                },
            });
            logger.info(`[Auth] Reactivated soft-deleted account ${softDeleted.id} for email ${emailNorm}`);
        } else {
            dbUser = await db.user.create({
                data: {
                    username,
                    displayName: username,
                    email: emailNorm,
                    passwordHash,
                    lastLoginAt: new Date(),
                },
            });
        }

        await buildSessionFromUser(req, dbUser, 'email');

        // Send verification email automatically
        try {
            const token = crypto.randomBytes(32).toString('hex');
            const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24);
            await db.user.update({ where: { id: dbUser.id }, data: { emailVerificationToken: token, emailVerificationExpiry: expiry } });

            let resendKey = process.env.RESEND_API_KEY;
            if (!resendKey) {
                try { const s = await emailService.getSettings(); resendKey = s.resendApiKey; } catch {}
            }
            if (resendKey) {
                const dashboardOrigin = process.env.DASHBOARD_ORIGIN || 'https://fujistud.io';
                const verifyUrl = `${dashboardOrigin}/api/auth/verify-email?token=${token}`;
                const resendClient = new Resend(resendKey);
                await resendClient.emails.send({
                    from: 'Fuji Studio <noreply@fujistud.io>',
                    to: [emailNorm],
                    subject: 'Verify your Fuji Studio email',
                    html: wrapEmailHtml(`
                        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1e2e;border-radius:16px;color:#e2e8f0;">
                            <h2 style="color:#2b8d70;margin-top:0;">Welcome to Fuji Studio!</h2>
                            <p>Hey <strong>${username}</strong>,</p>
                            <p>Click below to verify your email and complete your account setup.</p>
                            <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#2b8d70;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Verify Email</a>
                            <p style="color:#8A92A0;font-size:13px;">Or copy this link: <br>${verifyUrl}</p>
                        </div>
                    `),
                });
            }
        } catch (e) {
            logger.warn('[Auth] Failed to send verification email during registration', e);
        }

        req.session.save((err) => {
            if (err) return res.status(500).json({ error: 'Registration failed' });
            res.json({ success: true, user: req.session.user });
        });
    } catch (e) {
        logger.error('[Auth] Registration error', e);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// =============================================
// LOGIN (email/password with optional 2FA)
// =============================================
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => {
        // Key per email address so one user can't block others behind the same NAT/proxy IP
        const email = req.body?.email;
        return (email ? String(email).toLowerCase().trim() : null) || ipFromReq(req);
    },
    message: { error: 'Too many login attempts, try again later.' },
});
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { email, password, totpCode } = req.body;

        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const emailNorm = String(email).toLowerCase().trim();
        const dbUser = await db.user.findUnique({ where: { email: emailNorm } });
        if (!dbUser || !dbUser.passwordHash) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const valid = await verifyPassword(password, dbUser.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Block login if email not yet verified
        if (!dbUser.emailVerified) {
            return res.status(403).json({ error: 'Please verify your email address before signing in. Check your inbox for a verification link.', code: 'EMAIL_NOT_VERIFIED' });
        }
        if (dbUser.totpEnabled && dbUser.totpSecret) {
            if (!totpCode) {
                // Password correct but 2FA required \u2014 send challenge
                return res.status(200).json({ requiresTwoFactor: true });
            }
            // Verify TOTP code or backup code
            const isValidTotp = verifySync({ secret: dbUser.totpSecret, token: totpCode }).valid;
            if (!isValidTotp) {
                // Try backup codes
                let usedBackup = false;
                for (let i = 0; i < dbUser.totpBackupCodes.length; i++) {
                    const match = await verifyPassword(totpCode, dbUser.totpBackupCodes[i]);
                    if (match) {
                        // Remove used backup code
                        const remaining = [...dbUser.totpBackupCodes];
                        remaining.splice(i, 1);
                        await db.user.update({ where: { id: dbUser.id }, data: { totpBackupCodes: remaining } });
                        usedBackup = true;
                        break;
                    }
                }
                if (!usedBackup) {
                    return res.status(401).json({ error: 'Invalid two-factor code' });
                }
            }
        }

        await db.user.update({ where: { id: dbUser.id }, data: { lastLoginAt: new Date() } });
        await buildSessionFromUser(req, dbUser, 'email');

        req.session.save((err) => {
            if (err) return res.status(500).json({ error: 'Login failed' });
            res.json({ success: true, user: req.session.user });
        });
    } catch (e) {
        logger.error('[Auth] Login error', e);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Keep legacy endpoint working (redirects to new login)
app.post('/api/auth/email/login', loginLimiter, async (req, res) => {
    // Forward to new login handler by re-routing internally
    req.url = '/api/auth/login';
    (app as any).handle(req, res);
});

// =============================================
// FORGOT PASSWORD / RESET PASSWORD
// =============================================
const forgotPasswordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyGenerator: ipFromReq, message: { error: 'Too many requests, try again later.' } });
app.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const emailNorm = String(email).toLowerCase().trim();
        const dbUser = await db.user.findUnique({ where: { email: emailNorm } });

        // Always return success to prevent email enumeration
        if (!dbUser) return res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
        await db.user.update({ where: { id: dbUser.id }, data: { passwordResetToken: token, passwordResetExpiry: expiry } });

        let resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) {
            try { const s = await emailService.getSettings(); resendKey = s.resendApiKey; } catch {}
        }
        if (resendKey) {
            const dashboardOrigin = process.env.DASHBOARD_ORIGIN || 'https://fujistud.io';
            const resetUrl = `${dashboardOrigin}/reset-password?token=${token}`;
            const resendClient = new Resend(resendKey);
            await resendClient.emails.send({
                from: 'Fuji Studio <noreply@fujistud.io>',
                to: [emailNorm],
                subject: 'Reset your Fuji Studio password',
                html: wrapEmailHtml(`
                    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1e2e;border-radius:16px;color:#e2e8f0;">
                        <h2 style="color:#2b8d70;margin-top:0;">Password Reset</h2>
                        <p>Hey <strong>${dbUser.displayName || dbUser.username}</strong>,</p>
                        <p>Someone requested a password reset for your Fuji Studio account. Click below \u2014 this link expires in 1 hour.</p>
                        <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#2b8d70;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Reset Password</a>
                        <p style="color:#8A92A0;font-size:13px;">Or copy this link: <br>${resetUrl}</p>
                        <p style="color:#8A92A0;font-size:12px;margin-top:32px;">If you didn't request this, ignore this email. Your password won't change.</p>
                    </div>
                `),
            });
        }

        res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
    } catch (e) {
        logger.error('[Auth] forgot-password error', e);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const dbUser = await db.user.findFirst({
            where: { passwordResetToken: token, passwordResetExpiry: { gt: new Date() } },
        });
        if (!dbUser) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

        const passwordHash = await hashPassword(password);
        await db.user.update({
            where: { id: dbUser.id },
            data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null },
        });

        res.json({ success: true });
    } catch (e) {
        logger.error('[Auth] reset-password error', e);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// =============================================
// TWO-FACTOR AUTHENTICATION (TOTP)
// =============================================
// Step 1: Generate secret + QR code (does NOT enable yet)
app.post('/api/auth/2fa/setup', requireAuth, async (req: any, res) => {
    try {
        const dbUser = await db.user.findFirst({ where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] } });
        if (!dbUser) return res.status(404).json({ error: 'Account not found' });
        if (dbUser.totpEnabled) return res.status(400).json({ error: 'Two-factor authentication is already enabled' });

        const secret = generateSecret();
        // Store the secret temporarily \u2014 will finalize when user confirms with a valid code
        await db.user.update({ where: { id: dbUser.id }, data: { totpSecret: secret } });

        const otpauth = generateURI({ strategy: 'totp', secret, issuer: 'Fuji Studio', label: dbUser.email || dbUser.username });
        const qrDataUrl = await QRCode.toDataURL(otpauth);

        res.json({ secret, qrCode: qrDataUrl });
    } catch (e) {
        logger.error('[Auth] 2FA setup error', e);
        res.status(500).json({ error: 'Failed to set up 2FA' });
    }
});

// Step 2: Verify code + enable 2FA, return backup codes
app.post('/api/auth/2fa/verify', requireAuth, async (req: any, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Verification code is required' });

        const dbUser = await db.user.findFirst({ where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] } });
        if (!dbUser || !dbUser.totpSecret) return res.status(400).json({ error: 'No 2FA setup in progress' });
        if (dbUser.totpEnabled) return res.status(400).json({ error: '2FA is already active' });

        const isValid = verifySync({ secret: dbUser.totpSecret, token: code }).valid;
        if (!isValid) return res.status(401).json({ error: 'Invalid code. Make sure you entered the current code from your authenticator app.' });

        // Generate backup codes
        const backupCodes: string[] = [];
        const hashedCodes: string[] = [];
        for (let i = 0; i < 8; i++) {
            const code = crypto.randomBytes(8).toString('hex'); // SEC-07: 16-char hex = 64-bit entropy
            backupCodes.push(code);
            hashedCodes.push(await hashPassword(code));
        }

        await db.user.update({
            where: { id: dbUser.id },
            data: { totpEnabled: true, totpBackupCodes: hashedCodes },
        });

        req.session.user._totpEnabled = true;
        res.json({ success: true, backupCodes });
    } catch (e) {
        logger.error('[Auth] 2FA verify error', e);
        res.status(500).json({ error: 'Failed to enable 2FA' });
    }
});

// Disable 2FA (requires password confirmation)
app.post('/api/auth/2fa/disable', requireAuth, async (req: any, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password is required to disable 2FA' });

        const dbUser = await db.user.findFirst({ where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] } });
        if (!dbUser) return res.status(404).json({ error: 'Account not found' });
        if (!dbUser.totpEnabled) return res.status(400).json({ error: '2FA is not enabled' });
        if (!dbUser.passwordHash) return res.status(400).json({ error: 'No password set' });

        const valid = await verifyPassword(password, dbUser.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Incorrect password' });

        await db.user.update({
            where: { id: dbUser.id },
            data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] },
        });

        req.session.user._totpEnabled = false;
        res.json({ success: true });
    } catch (e) {
        logger.error('[Auth] 2FA disable error', e);
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

// =============================================
// DISCORD LINKING / UNLINKING
// =============================================
// Link Discord to existing account (initiates OAuth with state token)
app.get('/api/auth/discord/link', requireAuth, (req: any, res) => {
    const linkToken = crypto.randomBytes(16).toString('hex');
    req.session._discordLinkToken = linkToken;
    req.session._discordLinkReturn = req.query.returnTo || '/account';
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds email',
        state: `link_${linkToken}`,
        prompt: 'consent',
    });
    req.session.save(() => {
        res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    });
});

// Unlink Discord from account (requires password set)
app.post('/api/auth/discord/unlink', requireAuth, async (req: any, res) => {
    try {
        const dbUser = await db.user.findFirst({ where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] } });
        if (!dbUser) return res.status(404).json({ error: 'Account not found' });
        if (!dbUser.discordId) return res.status(400).json({ error: 'No Discord account linked' });
        if (!dbUser.passwordHash) return res.status(400).json({ error: 'You must set a password before unlinking Discord, or you will be locked out.' });

        await db.user.update({ where: { id: dbUser.id }, data: { discordId: null } });
        req.session.user.id = dbUser.id;
        req.session.guilds = [];
        req.session.mutualAdminGuilds = [];
        req.session.mutualStaffGuilds = [];
        req.session.isGuildMember = false;

        res.json({ success: true });
    } catch (e) {
        logger.error('[Auth] Discord unlink error', e);
        res.status(500).json({ error: 'Failed to unlink Discord' });
    }
});

// Get current account info (email, password status, 2FA)
app.get('/api/auth/account', requireAuth, async (req: any, res) => {
    try {
        const dbUser = await db.user.findFirst({ where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] } });
        if (!dbUser) return res.json({ hasAccount: false });

        res.json({
            hasAccount: true,
            email: dbUser.email,
            emailVerified: !!dbUser.emailVerified,
            hasPassword: !!dbUser.passwordHash,
            username: dbUser.username,
            discordLinked: !!dbUser.discordId,
            discordId: dbUser.discordId,
            totpEnabled: !!dbUser.totpEnabled,
            backupCodesRemaining: dbUser.totpBackupCodes.length,
            lastLoginAt: dbUser.lastLoginAt,
            createdAt: dbUser.createdAt,
            pendingEmail: dbUser.pendingEmail || null,
        });
    } catch (e) {
        logger.error('[Auth] Failed to get account info', e);
        res.status(500).json({ error: 'Failed to get account info' });
    }
});

// =============================================
// SET EMAIL (first-time setup � Discord-created accounts without email)
// =============================================
app.post('/api/auth/set-email', requireAuth, async (req: any, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email is required' });
        const emailNorm = email.toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) return res.status(400).json({ error: 'Invalid email address' });

        const dbUser = await db.user.findFirst({ where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] } });
        if (!dbUser) return res.status(404).json({ error: 'Account not found' });
        if (dbUser.email) return res.status(400).json({ error: 'Email is already set. Use the change-email endpoint instead.' });

        // Check email not already taken
        const existing = await db.user.findUnique({ where: { email: emailNorm } });
        if (existing) return res.status(409).json({ error: 'That email is already associated with another account' });

        // Set email and generate verification token
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
        await db.user.update({
            where: { id: dbUser.id },
            data: { email: emailNorm, emailVerificationToken: token, emailVerificationExpiry: expiry },
        });

        // Update session
        req.session.user._email = emailNorm;
        req.session.user._emailVerified = false;

        // Send verification email
        let resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) { try { const s = await emailService.getSettings(); resendKey = s.resendApiKey; } catch {} }
        if (resendKey) {
            const dashboardOrigin = process.env.DASHBOARD_ORIGIN || 'https://fujistud.io';
            const verifyUrl = `${dashboardOrigin}/api/auth/verify-email?token=${token}`;
            const resendClient = new Resend(resendKey);
            await resendClient.emails.send({
                from: 'Fuji Studio <noreply@fujistud.io>',
                to: [emailNorm],
                subject: 'Verify your Fuji Studio email',
                html: wrapEmailHtml(`<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1e2e;border-radius:16px;color:#e2e8f0;">
                    <h2 style="color:#2b8d70;margin-top:0;">Verify your email</h2>
                    <p>Hey <strong>${dbUser.displayName || dbUser.username}</strong>,</p>
                    <p>Click the button below to verify your email address for Fuji Studio. This link expires in 24 hours.</p>
                    <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#2b8d70;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Verify Email</a>
                    <p style="color:#8A92A0;font-size:13px;">Or copy this link: <br>${verifyUrl}</p>
                </div>`),
            });
        }

        res.json({ success: true, message: `Email set to ${emailNorm}. Verification email sent.` });
    } catch (e) {
        logger.error('[Auth] set-email error', e);
        res.status(500).json({ error: 'Failed to set email' });
    }
});

// Send email verification
app.post('/api/auth/send-verification', async (req: any, res) => {
    try {
        // Support both authenticated (session) and unauthenticated (email in body) requests
        let dbUser;
        if (req.session?.user) {
            dbUser = await db.user.findFirst({ where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] } });
        } else if (req.body?.email) {
            const emailNorm = String(req.body.email).toLowerCase().trim();
            dbUser = await db.user.findUnique({ where: { email: emailNorm } });
        }
        if (!dbUser) return res.status(404).json({ error: 'No account found' });
        if (!dbUser.email) return res.status(400).json({ error: 'No email on file.' });
        if (dbUser.emailVerified) return res.status(400).json({ error: 'Email is already verified' });

        // Rate-limit: allow resend only once per 5 minutes
        if (dbUser.emailVerificationExpiry && dbUser.emailVerificationExpiry > new Date(Date.now() - 1000 * 60 * 5)) {
            return res.status(429).json({ error: 'Verification email already sent recently. Please wait a few minutes.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
        await db.user.update({
            where: { id: dbUser.id },
            data: { emailVerificationToken: token, emailVerificationExpiry: expiry },
        });

        const dashboardOrigin = process.env.DASHBOARD_ORIGIN || 'https://fujistud.io';
        const verifyUrl = `${dashboardOrigin}/api/auth/verify-email?token=${token}`;

        // Get Resend key \u2014 prefer env var, fall back to email plugin settings
        let resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) {
            try {
                const emailSettings = await emailService.getSettings();
                resendKey = emailSettings.resendApiKey;
            } catch {}
        }
        if (!resendKey) return res.status(500).json({ error: 'Email service not configured. Set RESEND_API_KEY in your environment.' });

        const resendClient = new Resend(resendKey);
        const { error } = await resendClient.emails.send({
            from: 'Fuji Studio <noreply@fujistud.io>',
            to: [dbUser.email],
            subject: 'Verify your Fuji Studio email',
            html: wrapEmailHtml(`
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1e2e;border-radius:16px;color:#e2e8f0;">
                    <h2 style="color:#2b8d70;margin-top:0;">Verify your email</h2>
                    <p>Hey <strong>${dbUser.displayName || dbUser.username}</strong>,</p>
                    <p>Click the button below to verify your email address for Fuji Studio. This link expires in 24 hours.</p>
                    <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#2b8d70;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Verify Email</a>
                    <p style="color:#8A92A0;font-size:13px;">Or copy this link: <br>${verifyUrl}</p>
                    <p style="color:#8A92A0;font-size:12px;margin-top:32px;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            `),
        });

        if (error) {
            logger.error('[Auth] Failed to send verification email', error);
            return res.status(500).json({ error: 'Failed to send verification email' });
        }

        res.json({ success: true, message: `Verification email sent to ${dbUser.email}` });
    } catch (e) {
        logger.error('[Auth] send-verification error', e);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

// Verify email via token
app.get('/api/auth/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Invalid token' });

        const dbUser = await db.user.findFirst({
            where: {
                emailVerificationToken: token,
                emailVerificationExpiry: { gt: new Date() },
            },
        });

        if (!dbUser) {
            return res.redirect(`${process.env.DASHBOARD_ORIGIN || ''}/account?verified=false`);
        }

        await db.user.update({
            where: { id: dbUser.id },
            data: {
                emailVerified: new Date(),
                emailVerificationToken: null,
                emailVerificationExpiry: null,
            },
        });

        // Update session if the verified user is logged in
        if ((req.session?.user?.id && req.session.user.id === dbUser.discordId) || (req.session?.user?._localId && req.session.user._localId === dbUser.id)) {
            req.session.user._emailVerified = true;
        }

        res.redirect(`${process.env.DASHBOARD_ORIGIN || ''}/account?verified=true`);
    } catch (e) {
        logger.error('[Auth] verify-email error', e);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Change password (requires knowing current password, or can set new one if none set)
app.post('/api/auth/change-password', requireAuth, async (req: any, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const dbUser = await db.user.findFirst({ where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] } });
        if (!dbUser) return res.status(404).json({ error: 'No account found' });

        // If a password already exists, require current password
        if (dbUser.passwordHash) {
            if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
            const valid = await verifyPassword(currentPassword, dbUser.passwordHash);
            if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const passwordHash = await hashPassword(newPassword);
        await db.user.update({ where: { id: dbUser.id }, data: { passwordHash } });

        req.session.user._hasPassword = true;
        res.json({ success: true });
    } catch (e) {
        logger.error('[Auth] change-password error', e);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// =============================================
// CHANGE USERNAME
// =============================================
app.post('/api/auth/change-username', requireAuth, async (req: any, res) => {
    try {
        const { newUsername, currentPassword } = req.body;
        if (!newUsername) return res.status(400).json({ error: 'New username is required' });
        if (!/^[a-zA-Z0-9_-]{3,30}$/.test(newUsername)) {
            return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, underscores, hyphens only' });
        }

        const dbUser = await db.user.findFirst({ where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] } });
        if (!dbUser) return res.status(404).json({ error: 'Account not found' });

        // Require password verification
        if (!dbUser.passwordHash) return res.status(400).json({ error: 'Set a password first to verify your identity' });
        if (!currentPassword) return res.status(400).json({ error: 'Current password is required to change username' });
        const valid = await verifyPassword(currentPassword, dbUser.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Incorrect password' });

        // Check uniqueness (case-insensitive)
        const existing = await db.user.findFirst({ where: { username: { equals: newUsername, mode: 'insensitive' }, NOT: { id: dbUser.id } } });
        if (existing) return res.status(409).json({ error: 'That username is already taken' });

        await db.user.update({ where: { id: dbUser.id }, data: { username: newUsername } });
        res.json({ success: true, username: newUsername });
    } catch (e) {
        logger.error('[Auth] change-username error', e);
        res.status(500).json({ error: 'Failed to change username' });
    }
});

// =============================================
// CHANGE EMAIL (sends verification to new email)
// =============================================
app.post('/api/auth/change-email', requireAuth, async (req: any, res) => {
    try {
        const { newEmail, currentPassword } = req.body;
        if (!newEmail) return res.status(400).json({ error: 'New email is required' });
        const emailNorm = String(newEmail).toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) return res.status(400).json({ error: 'Invalid email address' });

        const dbUser = await db.user.findFirst({ where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] } });
        if (!dbUser) return res.status(404).json({ error: 'Account not found' });

        // Require password verification
        if (!dbUser.passwordHash) return res.status(400).json({ error: 'Set a password first to verify your identity' });
        if (!currentPassword) return res.status(400).json({ error: 'Current password is required to change email' });
        const valid = await verifyPassword(currentPassword, dbUser.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Incorrect password' });

        if (emailNorm === dbUser.email) return res.status(400).json({ error: 'That is already your current email address' });

        // Check email not already taken
        const existing = await db.user.findUnique({ where: { email: emailNorm } });
        if (existing) return res.status(409).json({ error: 'That email is already associated with another account' });

        // Rate limit: only once per 5 minutes
        if (dbUser.pendingEmailExpiry && dbUser.pendingEmailExpiry > new Date(Date.now() - 1000 * 60 * 5)) {
            return res.status(429).json({ error: 'A confirmation email was already sent recently. Please wait a few minutes.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
        await db.user.update({
            where: { id: dbUser.id },
            data: { pendingEmail: emailNorm, pendingEmailToken: token, pendingEmailExpiry: expiry },
        });

        let resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) { try { const s = await emailService.getSettings(); resendKey = s.resendApiKey; } catch {} }
        if (!resendKey) return res.status(500).json({ error: 'Email service not configured' });

        const dashboardOrigin = process.env.DASHBOARD_ORIGIN || 'https://fujistud.io';
        const confirmUrl = `${dashboardOrigin}/api/auth/confirm-email-change?token=${token}`;
        const resendClient = new Resend(resendKey);
        await resendClient.emails.send({
            from: 'Fuji Studio <noreply@fujistud.io>',
            to: [emailNorm],
            subject: 'Confirm your new email – Fuji Studio',
            html: wrapEmailHtml(`<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1e2e;border-radius:16px;color:#e2e8f0;">
                <h2 style="color:#2b8d70;margin-top:0;">Confirm email change</h2>
                <p>Hey <strong>${dbUser.displayName || dbUser.username}</strong>,</p>
                <p>Click below to confirm <strong>${emailNorm}</strong> as your new email address. This link expires in 24 hours.</p>
                <a href="${confirmUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#2b8d70;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Confirm New Email</a>
                <p style="color:#8A92A0;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
            </div>`),
        });

        res.json({ success: true, message: `Confirmation email sent to ${emailNorm}` });
    } catch (e) {
        logger.error('[Auth] change-email error', e);
        res.status(500).json({ error: 'Failed to initiate email change' });
    }
});

// =============================================
// CONFIRM EMAIL CHANGE (via token link � GET for email links)
// =============================================
app.get('/api/auth/confirm-email-change', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Invalid token' });

        const dashboardOrigin = process.env.DASHBOARD_ORIGIN || '';

        const dbUser = await db.user.findUnique({ where: { pendingEmailToken: token } });
        if (!dbUser || !dbUser.pendingEmail) {
            return res.redirect(`${dashboardOrigin}/account?emailChanged=false`);
        }
        if (dbUser.pendingEmailExpiry && dbUser.pendingEmailExpiry < new Date()) {
            return res.redirect(`${dashboardOrigin}/account?emailChanged=expired`);
        }

        const conflict = await db.user.findUnique({ where: { email: dbUser.pendingEmail } });
        if (conflict && conflict.id !== dbUser.id) {
            return res.redirect(`${dashboardOrigin}/account?emailChanged=conflict`);
        }

        await db.user.update({
            where: { id: dbUser.id },
            data: {
                email: dbUser.pendingEmail,
                emailVerified: new Date(),
                pendingEmail: null,
                pendingEmailToken: null,
                pendingEmailExpiry: null,
            },
        });

        if ((req.session as any)?.user?._localId === dbUser.id) {
            (req.session as any).user._email = dbUser.pendingEmail;
            (req.session as any).user._emailVerified = true;
        }

        res.redirect(`${dashboardOrigin}/account?emailChanged=true`);
    } catch (e) {
        logger.error('[Auth] confirm-email-change GET error', e);
        res.status(500).json({ error: 'Failed to confirm email change' });
    }
});

// CONFIRM EMAIL CHANGE (POST � legacy/API usage)
app.post('/api/auth/confirm-email-change', async (req: any, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        const dbUser = await db.user.findUnique({ where: { pendingEmailToken: token } });
        if (!dbUser || !dbUser.pendingEmail) return res.status(400).json({ error: 'Invalid or expired confirmation link' });
        if (dbUser.pendingEmailExpiry && dbUser.pendingEmailExpiry < new Date()) {
            return res.status(400).json({ error: 'This confirmation link has expired. Please request a new email change.' });
        }

        // Double-check email isn't taken by someone else now
        const conflict = await db.user.findUnique({ where: { email: dbUser.pendingEmail } });
        if (conflict && conflict.id !== dbUser.id) return res.status(409).json({ error: 'That email is already in use' });

        await db.user.update({
            where: { id: dbUser.id },
            data: {
                email: dbUser.pendingEmail,
                emailVerified: new Date(),
                pendingEmail: null,
                pendingEmailToken: null,
                pendingEmailExpiry: null,
            },
        });

        // Update session if this is the logged-in user
        if (req.session?.user?._localId === dbUser.id) {
            req.session.user._email = dbUser.pendingEmail;
            req.session.user._emailVerified = true;
        }

        res.json({ success: true, email: dbUser.pendingEmail });
    } catch (e) {
        logger.error('[Auth] confirm-email-change error', e);
        res.status(500).json({ error: 'Failed to confirm email change' });
    }
});

// Auth status endpoint (returns user and mutual admin guilds)
// Refresh guild/admin status for email-logged-in users with a linked Discord account
app.post('/api/auth/refresh-guilds', requireAuth, async (req: any, res) => {
    try {
        const dbUser = await db.user.findFirst({
            where: { OR: [{ discordId: req.session.user.id }, { id: req.session.user._localId }] },
        });
        if (!dbUser) return res.status(404).json({ error: 'Account not found' });
        await buildSessionFromUser(req, dbUser, 'email');
        await new Promise<void>((resolve, reject) => req.session.save((err: any) => err ? reject(err) : resolve()));
        res.json({ success: true, mutualAdminGuilds: req.session.mutualAdminGuilds, mutualStaffGuilds: req.session.mutualStaffGuilds, isGuildMember: req.session.isGuildMember });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/auth/status', async (req, res) => {
  if (req.session.user) {
    // Refresh guild access on every status check (uses cached Discord roles + fresh DB data)
    await refreshSessionGuilds(req);

    // Re-read invited from DB (catches manual invites + previous auto-invites)
    let invited = !!req.session.user._invited;
    try {
        if (!invited && req.session.user._localId) {
            const freshUser = await db.user.findUnique({ where: { id: req.session.user._localId }, select: { invited: true } });
            if (freshUser?.invited) {
                req.session.user._invited = true;
                invited = true;
            }
        }
    } catch { /* non-fatal */ }

    // Beta role check: if user has a configured beta role, treat as invited
    if (!invited && req.session.user.id) {
        try {
            const primaryGuildId = process.env.GUILD_ID;
            logger.info(`[Auth/Beta] Checking beta roles for ${req.session.user.username} (${req.session.user.id}), guildId=${primaryGuildId}`);
            if (primaryGuildId) {
                const rows: any[] = await db.$queryRaw`SELECT "betaRoleIds" FROM "dashboard_access" WHERE "guildId" = ${primaryGuildId} LIMIT 1`;
                const betaRoleIds: string[] = rows[0]?.betaRoleIds || [];
                logger.info(`[Auth/Beta] betaRoleIds from DB: ${JSON.stringify(betaRoleIds)} (count=${betaRoleIds.length})`);
                if (betaRoleIds.length > 0) {
                    const cacheKey = `${primaryGuildId}:${req.session.user.id}`;
                    const cached = memberRoleCache.get(cacheKey);
                    let memberRoles: string[];
                    if (cached && (Date.now() - cached.timestamp < MEMBER_ROLE_CACHE_TTL)) {
                        memberRoles = cached.roles;
                        logger.info(`[Auth/Beta] Using cached roles for ${req.session.user.id}: ${JSON.stringify(memberRoles)}`);
                    } else {
                        const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${primaryGuildId}/members/${req.session.user.id}`, {
                            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                            timeout: 5000
                        });
                        memberRoles = memberRes.data.roles || [];
                        memberRoleCache.set(cacheKey, { roles: memberRoles, timestamp: Date.now() });
                        logger.info(`[Auth/Beta] Fetched Discord roles for ${req.session.user.id}: ${JSON.stringify(memberRoles)}`);
                    }
                    const hasMatch = memberRoles.some((r: string) => betaRoleIds.includes(r));
                    logger.info(`[Auth/Beta] Role match result: ${hasMatch}`);
                    if (hasMatch) {
                        invited = true;
                        req.session.user._invited = true;
                        // Persist to DB so future logins are instant
                        if (req.session.user._localId) {
                            db.user.update({ where: { id: req.session.user._localId }, data: { invited: true } }).catch(() => {});
                        }
                        logger.info(`[Auth] Beta role match for ${req.session.user.username} (${req.session.user.id})`);
                    }
                }
            }
        } catch (e) {
            logger.warn(`[Auth] Beta role check failed in /status`, e);
        }
    }

    // Fetch MusicianProfile avatar/displayName/username for the session user.
    // Profiles may be stored under either the internal cuid (_localId) or the Discord
    // snowflake (session.user.id) depending on when they were created, so query both.
    let profileAvatar: string | null = null;
    let profileDisplayName: string | null = null;
    let profileUsername: string | null = null;
    try {
        const idsToCheck = [...new Set([
            req.session.user._localId,
            req.session.user.id,
        ].filter(Boolean))] as string[];
        const mp = await db.musicianProfile.findFirst({
            where: { userId: { in: idsToCheck } },
            select: { avatar: true, displayName: true, username: true },
        });
        if (mp) {
            profileAvatar = mp.avatar || null;
            profileDisplayName = mp.displayName || mp.username || null;
            profileUsername = mp.username || null;
        }
    } catch { /* non-fatal */ }

    res.json({
      authenticated: true,
      user: req.session.user,
      profileAvatar,
      profileDisplayName,
      profileUsername,
      mutualAdminGuilds: req.session.mutualAdminGuilds || [],
      mutualStaffGuilds: req.session.mutualStaffGuilds || [],
      isGuildMember: req.session.isGuildMember ?? false,
      hasLocalAccount: !!req.session.user._localId,
      hasPassword: !!req.session.user._hasPassword,
      email: req.session.user._email || null,
      emailVerified: !!req.session.user._emailVerified,
      totpEnabled: !!req.session.user._totpEnabled,
      loginMethod: req.session.user._loginMethod || 'discord',
      invited,
      role: req.session.user._role || 'user',
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

// Refresh session guild access (admin + staff) using fresh DB data + cached Discord roles
async function refreshSessionGuilds(req: any): Promise<void> {
    const user = req.session?.user;
    if (!user) return;
    const discordId = user.id;
    if (!discordId) return;

    try {
        const botGuilds = await getBotGuildIds();
        if (!botGuilds.length) return;

        const mutualAdminGuilds: any[] = [];
        const mutualStaffGuilds: any[] = [];

        // OAuth sessions store guild permissions; email sessions don't
        const oauthGuilds = req.session.guilds || [];
        const oauthGuildMap = new Map<string, any>(oauthGuilds.map((g: any) => [g.id, g]));
        // Keep track of which guilds were previously admin (for email logins where we can't re-check Discord permissions)
        const prevAdminIds = new Set((req.session.mutualAdminGuilds || []).map((g: any) => g.id));

        for (const botGuild of botGuilds) {
            const oauthGuild = oauthGuildMap.get(botGuild.id) as { permissions: string; owner: boolean } | undefined;

            // Check admin status
            let isAdmin = false;
            if (oauthGuild) {
                // OAuth login � use cached permissions from Discord
                const perms = BigInt(oauthGuild.permissions);
                isAdmin = oauthGuild.owner || (perms & BigInt(0x8)) === BigInt(0x8);
            } else {
                // Email login � preserve previous admin status (can't re-check without OAuth token)
                isAdmin = prevAdminIds.has(botGuild.id);
            }

            if (isAdmin) {
                mutualAdminGuilds.push({ id: botGuild.id, name: botGuild.name, icon: botGuild.icon });
                continue;
            }

            // Check staff access (fresh DB read + cached Discord roles)
            try {
                const access = await db.dashboardAccess.findUnique({ where: { guildId: botGuild.id } });
                if (access && access.allowedRoles.length > 0) {
                    const cacheKey = `${botGuild.id}:${discordId}`;
                    const cached = memberRoleCache.get(cacheKey);
                    let memberRoles: string[];
                    if (cached && (Date.now() - cached.timestamp < MEMBER_ROLE_CACHE_TTL)) {
                        memberRoles = cached.roles;
                    } else {
                        const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${botGuild.id}/members/${discordId}`, {
                            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                            timeout: 5000
                        });
                        memberRoles = memberRes.data.roles || [];
                        memberRoleCache.set(cacheKey, { roles: memberRoles, timestamp: Date.now() });
                    }
                    if (memberRoles.some((r: string) => access.allowedRoles.includes(r))) {
                        mutualStaffGuilds.push({ id: botGuild.id, name: botGuild.name, icon: botGuild.icon });
                    }
                }
            } catch {
                // Skip � user may not be a member of this guild
            }
        }

        req.session.mutualAdminGuilds = mutualAdminGuilds;
        req.session.mutualStaffGuilds = mutualStaffGuilds;

        // Refresh primary guild membership status
        const primaryGuildId = process.env.GUILD_ID;
        if (primaryGuildId && discordId) {
            const cacheKey = `${primaryGuildId}:${discordId}`;
            const cached = memberRoleCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < MEMBER_ROLE_CACHE_TTL)) {
                req.session.isGuildMember = true;
            } else {
                try {
                    const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${primaryGuildId}/members/${discordId}`, {
                        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                        timeout: 5000
                    });
                    const memberRoles: string[] = memberRes.data.roles || [];
                    memberRoleCache.set(cacheKey, { roles: memberRoles, timestamp: Date.now() });
                    req.session.isGuildMember = true;
                } catch (e: any) {
                    if (e.response?.status === 404) {
                        req.session.isGuildMember = false;
                    }
                    // Other errors: keep existing value
                }
            }
        }
    } catch (e) {
        logger.warn('[Auth] Failed to refresh session guilds', e);
    }
}

// Helper: Check if user has any dashboard access to a guild (admin OR staff role)
const hasDashboardAccess = (guildId: string, req: any) => {
    if (isTrueAdmin(guildId, req)) return true;
    const mutualStaffGuilds = req.session.mutualStaffGuilds || [];
    return mutualStaffGuilds.some((g: any) => g.id === guildId);
};

// Helper: Check if True Admin (Owner or Administrator perm)
const isTrueAdmin = (guildId: string, req: any) => {
    // Check mutualAdminGuilds (populated by both Discord OAuth and bot-token email login)
    const mutualAdminGuilds = req.session.mutualAdminGuilds || [];
    if (mutualAdminGuilds.some((g: any) => g.id === guildId)) return true;

    // Check guild permissions from Discord OAuth session (only available for Discord OAuth logins)
    const userGuilds = req.session.guilds || [];
    const guild = userGuilds.find((g: any) => g.id === guildId);
    if (!guild) return false;
    const permissions = BigInt(guild.permissions);
    return Boolean(guild.owner || (permissions & BigInt(0x8)) === BigInt(0x8));
};

// Simple TTL cache for Discord user lookups (60-second TTL)
const discordUserCache = new Map<string, { username: string; avatar: string | null; expiresAt: number }>();

async function fetchDiscordUsername(userId: string): Promise<{ username: string; avatar: string | null }> {
    const cached = discordUserCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
        return { username: cached.username, avatar: cached.avatar };
    }
    try {
        const resp = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
        });
        const user = resp.data;
        const username = user.global_name || user.username || userId;
        const avatar = user.avatar
            ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`
            : null;
        discordUserCache.set(userId, { username, avatar, expiresAt: Date.now() + 60_000 });
        return { username, avatar };
    } catch {
        return { username: userId, avatar: null };
    }
}

async function enrichMembersWithUsernames<T extends { userId: string }>(members: T[]): Promise<(T & { username: string; avatar: string | null })[]> {
    const results = await Promise.allSettled(members.map(m => fetchDiscordUsername(m.userId)));
    return members.map((m, i) => {
        const r = results[i];
        const { username, avatar } = r.status === 'fulfilled' ? r.value : { username: m.userId, avatar: null };
        return { ...m, username, avatar };
    });
}

// Helper: Check Plugin Access
const checkPluginAccess = async (guildId: string, req: any, pluginId: string): Promise<boolean> => {
    const user = req.session.user;
    if (!user) return false;

    // 1. Check if Admin (via session cache)
    if (isTrueAdmin(guildId, req)) return true;

    // 2. Check Role Whitelist
    try {
        const settingsKey = `${guildId}:${pluginId}`;
        const cachedSettings = pluginSettingsCache.get(settingsKey);
        let settings;
        if (cachedSettings && (Date.now() - cachedSettings.timestamp < PLUGIN_SETTINGS_CACHE_TTL)) {
            settings = cachedSettings.data;
        } else {
            settings = await db.pluginSettings.findUnique({
                 where: { guildId_pluginId: { guildId, pluginId } }
            });
            pluginSettingsCache.set(settingsKey, { data: settings, timestamp: Date.now() });
        }
        
        // If settings don't exist or no roles allowed, allow ONLY Admins (which returned above)
        if (!settings || settings.allowedRoles.length === 0) return false;

        // Fetch User Roles from Discord (with cache)
        try {
            const cacheKey = `${guildId}:${user.id}`;
            const cachedMember = memberRoleCache.get(cacheKey);
            let memberRoles: string[];
            if (cachedMember && (Date.now() - cachedMember.timestamp < MEMBER_ROLE_CACHE_TTL)) {
                memberRoles = cachedMember.roles;
            } else {
                const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${user.id}`, {
                    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                    timeout: 5000
                });
                memberRoles = memberRes.data.roles || [];
                memberRoleCache.set(cacheKey, { roles: memberRoles, timestamp: Date.now() });
            }
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

    // Verify group belongs to the authorized guild
    const existing = await db.wordGroup.findUnique({ where: { id: groupId } });
    if (!existing || existing.guildId !== guildId) return res.status(403).json({ error: 'Forbidden' });

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

    // Verify group belongs to the authorized guild
    const existing = await db.wordGroup.findUnique({ where: { id: groupId } });
    if (!existing || existing.guildId !== guildId) return res.status(403).json({ error: 'Forbidden' });

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

    // Verify group belongs to the authorized guild
    const group = await db.wordGroup.findUnique({ where: { id: groupId } });
    if (!group || group.guildId !== guildId) return res.status(403).json({ error: 'Forbidden' });

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

    // Verify word belongs to a group in the authorized guild
    const word = await db.filterWord.findUnique({ where: { id: wordId }, include: { group: true } });
    if (!word || word.group.guildId !== guildId) return res.status(403).json({ error: 'Forbidden' });

    await db.filterWord.delete({
      where: { id: wordId },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete word', error);
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

// --- Anti-Piracy Plugin Routes ------------------------------------------------

app.get('/api/anti-piracy/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'anti-piracy')) return res.status(403).json({ error: 'Forbidden' });

    let settings = await db.antiPiracySettings.findUnique({
      where: { guildId },
    });

    if (!settings) {
      // Auto-create defaults
      await db.guild.upsert({
        where: { id: guildId },
        update: {},
        create: { id: guildId, name: 'Unknown' },
      });
      settings = await db.antiPiracySettings.create({
        data: {
          guildId,
          enabled: true,
          aiEnabled: true,
          actionType: 'delete_and_warn',
          reminderMessage: 'Piracy discussion is not allowed in this server. Please support developers by purchasing software legally.',
          excludedChannels: [],
          excludedRoles: [],
          customKeywords: [],
        },
      });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Failed to get anti-piracy settings', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

app.post('/api/anti-piracy/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'anti-piracy')) return res.status(403).json({ error: 'Forbidden' });

    const allowedFields = ['enabled', 'aiEnabled', 'actionType', 'reminderMessage', 'excludedChannels', 'excludedRoles', 'customKeywords'];
    const data: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        data[key] = req.body[key];
      }
    }

    // Validate actionType if provided
    if (data.actionType && !['warn', 'delete', 'delete_and_warn'].includes(data.actionType)) {
      return res.status(400).json({ error: 'Invalid actionType' });
    }

    const settings = await db.antiPiracySettings.upsert({
      where: { guildId },
      update: data,
      create: {
        guildId,
        ...data,
      },
    });

    res.json(settings);
  } catch (error) {
    logger.error('Failed to update anti-piracy settings', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.get('/api/anti-piracy/logs/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'anti-piracy')) return res.status(403).json({ error: 'Forbidden' });

    const logs = await db.actionLog.findMany({
      where: {
        guildId,
        pluginId: 'anti-piracy',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(logs);
  } catch (error) {
    logger.error('Failed to get anti-piracy logs', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// --- Leveling Plugin Routes ----------------------------------------------------

// GET leveling settings
app.get('/api/leveling/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'leveling')) return res.status(403).json({ error: 'Forbidden' });

    let settings = await db.levelingSettings.findUnique({
      where: { guildId },
      include: { roleRewards: { orderBy: { level: 'asc' } } },
    });

    if (!settings) {
      await db.guild.upsert({
        where: { id: guildId },
        update: {},
        create: { id: guildId, name: 'Unknown' },
      });
      settings = await db.levelingSettings.create({
        data: { guildId },
        include: { roleRewards: { orderBy: { level: 'asc' } } },
      });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Failed to get leveling settings', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// POST update leveling settings
app.post('/api/leveling/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'leveling')) return res.status(403).json({ error: 'Forbidden' });

    const allowedFields = [
      'enabled', 'messageXpEnabled', 'voiceXpEnabled', 'reactionXpEnabled',
      'xpMultiplier', 'messageXpMin', 'messageXpMax', 'voiceXpPerMinute',
      'reactionGivenXp', 'reactionReceivedXp', 'messageCooldownSec',
      'levelUpChannelId', 'blacklistedChannels', 'blacklistedRoles',
      'levelUpMessage', 'announceRoleReward',
      // Economy synergy fields
      'economyRewardsEnabled', 'levelUpCurrencyReward', 'milestoneLevels',
      'microRewardsEnabled', 'microRewardAmount', 'microRewardReactions', 'microRewardVoiceMin',
      'activityScalingEnabled', 'xpBoosterEnabled', 'xpBoosterPrice',
      'xpBoosterMultiplier', 'xpBoosterDurationMin',
    ];

    const data: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        data[key] = req.body[key];
      }
    }

    // Validate numeric ranges
    if (data.xpMultiplier !== undefined && (data.xpMultiplier < 0.1 || data.xpMultiplier > 10)) {
      return res.status(400).json({ error: 'xpMultiplier must be between 0.1 and 10' });
    }
    if (data.messageCooldownSec !== undefined && (data.messageCooldownSec < 0 || data.messageCooldownSec > 600)) {
      return res.status(400).json({ error: 'messageCooldownSec must be between 0 and 600' });
    }

    const settings = await db.levelingSettings.upsert({
      where: { guildId },
      update: data,
      create: { guildId, ...data },
    });

    res.json(settings);
  } catch (error) {
    logger.error('Failed to update leveling settings', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET leaderboard
app.get('/api/leveling/leaderboard/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'leveling')) return res.status(403).json({ error: 'Forbidden' });

    const type = (req.query.type as string) || 'xp';
    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const perPage = 20;

    // Power Score leaderboard � computed in-memory
    if (type === 'power') {
      const allMembers = await db.member.findMany({
        where: { guildId },
        select: { userId: true, level: true, totalXp: true },
      });
      const accounts = await db.economyAccount.findMany({
        where: { guildId },
        select: { userId: true, balance: true },
      }).catch(() => [] as { userId: string; balance: number }[]);

      const balanceMap = new Map(accounts.map((a: any) => [a.userId, a.balance]));
      const scored = allMembers.map(m => ({
        ...m,
        balance: balanceMap.get(m.userId) ?? 0,
        powerScore: m.level * 100 + (balanceMap.get(m.userId) ?? 0),
      })).sort((a, b) => b.powerScore - a.powerScore);

      const total = scored.length;
      const members = scored.slice(page * perPage, (page + 1) * perPage);
      const enrichedPower = await enrichMembersWithUsernames(members);
      return res.json({ members: enrichedPower, total, page, perPage });
    }

    const orderBy = type === 'voice' ? { voiceMinutes: 'desc' as const }
      : type === 'messages' ? { messagesCount: 'desc' as const }
      : { totalXp: 'desc' as const };

    const [members, total] = await Promise.all([
      db.member.findMany({
        where: { guildId },
        orderBy,
        skip: page * perPage,
        take: perPage,
      }),
      db.member.count({ where: { guildId } }),
    ]);

    const enriched = await enrichMembersWithUsernames(members);
    res.json({ members: enriched, total, page, perPage });
  } catch (error) {
    logger.error('Failed to get leaderboard', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// GET role rewards
app.get('/api/leveling/role-rewards/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'leveling')) return res.status(403).json({ error: 'Forbidden' });

    const settings = await db.levelingSettings.findUnique({ where: { guildId } });
    if (!settings) return res.json([]);

    const rewards = await db.levelRoleReward.findMany({
      where: { settingsId: settings.id },
      orderBy: { level: 'asc' },
    });

    res.json(rewards);
  } catch (error) {
    logger.error('Failed to get role rewards', error);
    res.status(500).json({ error: 'Failed to get role rewards' });
  }
});

// POST add/update role reward
app.post('/api/leveling/role-rewards/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'leveling')) return res.status(403).json({ error: 'Forbidden' });

    const { level, roleId, sticky } = req.body;
    if (!level || !roleId || typeof level !== 'number' || typeof roleId !== 'string') {
      return res.status(400).json({ error: 'level (number) and roleId (string) are required' });
    }

    let settings = await db.levelingSettings.findUnique({ where: { guildId } });
    if (!settings) {
      settings = await db.levelingSettings.create({ data: { guildId } });
    }

    const reward = await db.levelRoleReward.upsert({
      where: { settingsId_level: { settingsId: settings.id, level } },
      update: { roleId, sticky: sticky ?? true },
      create: { settingsId: settings.id, level, roleId, sticky: sticky ?? true },
    });

    res.json(reward);
  } catch (error) {
    logger.error('Failed to save role reward', error);
    res.status(500).json({ error: 'Failed to save role reward' });
  }
});

// DELETE role reward
app.delete('/api/leveling/role-rewards/:guildId/:level', async (req, res) => {
  try {
    const { guildId, level } = req.params;
    if (!await checkPluginAccess(guildId, req, 'leveling')) return res.status(403).json({ error: 'Forbidden' });

    const settings = await db.levelingSettings.findUnique({ where: { guildId } });
    if (!settings) return res.status(404).json({ error: 'Settings not found' });

    await db.levelRoleReward.delete({
      where: { settingsId_level: { settingsId: settings.id, level: parseInt(level) } },
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete role reward', error);
    res.status(500).json({ error: 'Failed to delete role reward' });
  }
});

// GET active XP boosters for a guild
app.get('/api/leveling/boosters/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'leveling')) return res.status(403).json({ error: 'Forbidden' });

    const boosters = await db.xpBooster.findMany({
      where: { guildId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });

    res.json(boosters);
  } catch (error) {
    logger.error('Failed to get XP boosters', error);
    res.status(500).json({ error: 'Failed to get boosters' });
  }
});

// Guild Emojis Route
app.get('/api/guilds/:guildId/emojis', async (req, res) => {
  try {
    const { guildId } = req.params;

    // Auth check
    if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!hasDashboardAccess(guildId, req)) {
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
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
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

    // Map frontend categories to database action strings.
    // Each list includes the raw category string itself (for logs imported via /logger import)
    // AND the specific action strings logged by bot plugins / API events.
    const CATEGORY_ACTIONS: Record<string, string[]> = {
        'MOD': ['MOD', 'kick', 'ban', 'unban', 'timeout', 'untimeout', 'warn', 'purge', 'softban',
                'member_kick', 'member_ban', 'member_timeout', 'message_approved_web', 'message_rejected_web', 'announcement_posted'],
        'AUTOMOD': ['AUTOMOD', 'automod_block', 'spam_detected'],
        'ROLE': ['ROLE', 'role_create', 'role_delete', 'role_update', 'member_role_update'],
        'PROFANITY': ['PROFANITY', 'message_filtered', 'profanity_detected'],
        'CURRENCY': ['CURRENCY', 'item_bought', 'transaction'],
        'LINK': ['LINK', 'link_deleted', 'link_filtered'],
        'PIRACY': ['PIRACY', 'piracy_detected'],
        'ERROR': ['ERROR', 'error', 'command_error'],
        'PROFILES': ['PROFILES', 'profile_status_changed', 'track_status_changed', 'profile_wiped',
                     'track_uploaded', 'track_edited', 'track_deleted', 'profile_updated', 'avatar_uploaded',
                     'profile_admin_edited', 'avatar_admin_uploaded',
                     'battle_created', 'battle_updated', 'battle_deleted', 'FEEDBACK_THREAD_CREATED', 'FEEDBACK_APPROVED'],
        'COMMENTS': ['COMMENTS', 'comment_created', 'comment_replied', 'comment_reacted', 'comment_reaction_removed', 'comment_edited', 'comment_deleted'],
        'SOCIAL': ['SOCIAL', 'track_favourited', 'track_unfavourited', 'artist_followed', 'artist_unfollowed',
                   'track_reposted', 'track_unreposted'],
        'PLAYLISTS': ['PLAYLISTS', 'playlist_created', 'playlist_deleted', 'playlist_track_added', 'playlist_track_removed'],
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
    if (!hasDashboardAccess(log.guildId, req)) {
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
    if (!hasDashboardAccess(guildId, req)) {
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
    if (!hasDashboardAccess(guildId, req)) {
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
    if (!hasDashboardAccess(guildId, req)) {
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

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    // Run all independent queries in parallel
    const [
      history,
      topChannelsRaw,
      activeMembers,
      totalsAgg,
      recentLogs,
      openTickets,
      allEmails,
      economyAgg,
      welcomeSettings,
      filterSettings,
      artistCount,
      trackCount,
      openReports,
    ] = await Promise.all([
      // 1. Server Stats History — last 60 days, most recent first so take(60) never clips new data
      db.serverStats.findMany({
        where: { guildId, date: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } },
        orderBy: { date: 'asc' },
      }),
      // 2. Top Channels (Last 7 days)
      db.channelStats.groupBy({
        by: ['channelName'],
        where: { guildId, date: { gte: sevenDaysAgo } },
        _sum: { messages: true },
        orderBy: { _sum: { messages: 'desc' } },
        take: 10,
      }),
      // 3. Active Members (Last 24h)
      db.member.count({
        where: { guildId, lastActiveAt: { gte: yesterday } },
      }),
      // 4. Totals
      db.serverStats.aggregate({
        where: { guildId },
        _sum: { messageCount: true, voiceMinutes: true, newBans: true },
      }),
      // 5. Recent Logs
      db.actionLog.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // 6. Open Tickets
      db.ticket.count({ where: { guildId, status: 'open' } }),
      // 7. Emails
      emailService.getEmails('inbox'),
      // 8. Economy
      db.economyAccount.aggregate({
        where: { guildId },
        _sum: { balance: true },
      }),
      // 9. Welcome Settings
      db.welcomeGateSettings.findUnique({ where: { guildId } }),
      // 10. Filter Settings
      db.filterSettings.findUnique({ where: { guildId } }),
      // 11. Artist count (global � platform-wide Fuji Studio profiles)
      db.musicianProfile.count({ where: { status: 'active', deletedAt: null } }),
      // 12. Track count (global — platform-wide public tracks)
      db.track.count({ where: { status: 'active', isPublic: true, deletedAt: null } }),
      // 13. Open reports needing attention
      db.report.count({ where: { status: { in: ['open', 'reviewing'] } } }),
    ]);

    const topChannels = topChannelsRaw.map(c => ({
        name: c.channelName,
        messages: c._sum.messages || 0
    }));

    // 5b. Today's stats
    const todayStats = history.find(h => h.date.getTime() === today.getTime()) || null;
    
    // 5c. Current Member Count - Last recorded
    const latestStat = history[history.length - 1];
    const totalMembers = latestStat?.memberCount || 0;

    // Resolve user data for logs
    const resolvedLogs = await Promise.all(recentLogs.map(async log => {
      const executor = log.executorId ? await resolveUser(log.executorId) : null;
      return {
        ...log,
        executorName: executor?.username || 'System'
      };
    }));

    const unreadEmails = allEmails.filter(e => !e.read).length;

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
      artistCount,
      trackCount,
      recentLogs: resolvedLogs,
      pluginsData: {
        tickets: { open: openTickets },
        email: { unread: unreadEmails },
        economy: { totalBalance: economyAgg._sum.balance || 0 },
        welcome: { enabled: welcomeSettings?.enabled || false },
        filter: { enabled: filterSettings?.enabled || false },
        reports: { open: openReports },
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update basic settings
app.post('/api/guilds/:guildId/moderation', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { logChannelId, dmUponAction, kickMessage, banMessage, timeoutMessage, caseLogForumId, removeAlertRoleId } = req.body;
        
        if (!await checkPluginAccess(guildId, req, 'moderation')) return res.status(403).json({ error: 'Forbidden' });

        const settings = await db.moderationSettings.upsert({
            where: { guildId },
            update: { logChannelId, dmUponAction, kickMessage, banMessage, timeoutMessage, caseLogForumId, removeAlertRoleId },
            create: { guildId, logChannelId, dmUponAction, kickMessage, banMessage, timeoutMessage, caseLogForumId, removeAlertRoleId },
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

app.get('/api/plugins/list', requireAuth, (req, res) => {
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

        // Invalidate plugin settings cache
        pluginSettingsCache.delete(`${guildId}:${pluginId}`);
        
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

        // If admin, they have everything
        if (isAdmin) {
            return res.json({ 
                canManagePlugins: true, 
                accessiblePlugins: ['moderation', 'word-filter', 'logs', 'stats', 'logger', 'plugins', 'economy', 'production-feedback', 'welcome-gate', 'email-client', 'tickets', 'channel-rules', 'musician-profiles', 'musician-profiles-admin', 'discover-musicians', 'fuji-studio', 'beat-battle', 'featured-content', 'account-management', 'anti-piracy', 'leveling', 'fuji-radio', 'studio-guide', 'bot-identity', 'bot-messenger', 'booster-color', 'private-messages', 'auto-messages', 'auto-responder', 'server-boost', 'reports', 'articles', 'article-review', 'pause', 'voice-stats', 'spam-guard', 'track-announcer', 'profile-styles', 'academy', 'head-to-head', 'drum-kit']
            });
        }

        // For non-admins, check role whitelist against live data
        // 1. Get user roles (with short-lived cache to avoid Discord rate limits)
        const accessiblePlugins: string[] = [];
        const cacheKey = `${guildId}:${user.id}`;
        const cachedMember = memberRoleCache.get(cacheKey);
        let memberRoles: string[];
        if (cachedMember && (Date.now() - cachedMember.timestamp < MEMBER_ROLE_CACHE_TTL)) {
            memberRoles = cachedMember.roles;
        } else {
            const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${user.id}`, {
                headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
            });
            memberRoles = memberRes.data.roles || [];
            memberRoleCache.set(cacheKey, { roles: memberRoles, timestamp: Date.now() });
        }

        // 2. Get all plugin settings for this guild (fresh from DB)
        const allSettings = await db.pluginSettings.findMany({
            where: { guildId }
        });

        // 3. Match roles against allowedRoles for each plugin
        // Map plugin IDs to the dashboard section IDs the frontend expects
        const pluginIdToDashboardId: Record<string, string> = {
            'ticket': 'tickets',
        };

        for (const setting of allSettings) {
             if (setting.enabled && setting.allowedRoles.some((r: string) => memberRoles.includes(r))) {
                 const dashboardId = pluginIdToDashboardId[setting.pluginId] || setting.pluginId;
                 accessiblePlugins.push(dashboardId);
             }
        }

        res.json({ canManagePlugins: false, accessiblePlugins });

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
        
        const { currencyName, currencyEmoji, messageReward, messageCooldown, minMessageLength, autoNickname, allowTipping } = req.body;
        const allowedData: any = {};
        if (currencyName !== undefined) allowedData.currencyName = currencyName;
        if (currencyEmoji !== undefined) allowedData.currencyEmoji = currencyEmoji;
        if (messageReward !== undefined) allowedData.messageReward = messageReward;
        if (messageCooldown !== undefined) allowedData.messageCooldown = messageCooldown;
        if (minMessageLength !== undefined) allowedData.minMessageLength = minMessageLength;
        if (autoNickname !== undefined) allowedData.autoNickname = autoNickname;
        if (allowTipping !== undefined) allowedData.allowTipping = allowTipping;
        
        const settings = await db.economySettings.upsert({
            where: { guildId },
            update: allowedData,
            create: { guildId, ...allowedData }
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
        
        const { id, name, description, price, type, stock, metadata, purchaseLimitCount, purchaseLimitDays } = req.body;

        // Validation
        if (!name || price < 0) return res.status(400).json({ error: 'Invalid data' });

        const itemData = {
            name, description, price, type, stock,
            metadata,
            purchaseLimitCount: purchaseLimitCount != null ? Number(purchaseLimitCount) || null : null,
            purchaseLimitDays:  purchaseLimitDays  != null ? Number(purchaseLimitDays)  || null : null,
        };

        if (id) {
             const existing = await db.economyItem.findUnique({ where: { id } });
             if (!existing || existing.guildId !== guildId) return res.status(403).json({ error: 'Forbidden' });
             const item = await db.economyItem.update({ where: { id }, data: itemData });
             res.json(item);
        } else {
             const item = await db.economyItem.create({ data: { guildId, ...itemData } });
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
        
        // Verify item belongs to the authorized guild
        const existing = await db.economyItem.findUnique({ where: { id: itemId } });
        if (!existing || existing.guildId !== guildId) return res.status(403).json({ error: 'Forbidden' });
        
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

        const updated = await db.$transaction(async (tx) => {
            const acc = await tx.economyAccount.upsert({
                where: { guildId_userId: { guildId, userId } },
                update: { balance: newBalance },
                create: { guildId, userId, balance: newBalance }
            });
            await tx.economyTransaction.create({
                data: {
                    guildId,
                    amount: mode === 'set' ? (amount - (account?.balance || 0)) : amount,
                    type: 'ADMIN',
                    reason: 'Vault Adjustment',
                    toUserId: userId
                }
            });
            return acc;
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
        // Allow if admin OR user can access the plugin page (via accessiblePlugins)
        const user = req.session.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        const isAdmin = isTrueAdmin(guildId, req);
        if (!isAdmin) {
            // Check if user has any role that grants plugin access
            const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${user.id}`, {
                headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                timeout: 5000
            }).catch(() => ({ data: { roles: [] } }));
            const memberRoles = memberRes.data.roles || [];
            
            // Check plugin settings for allowed roles
            const settings = await db.pluginSettings.findUnique({
                where: { guildId_pluginId: { guildId, pluginId: 'production-feedback' } }
            });
            const hasAccess = settings?.allowedRoles?.some((r: string) => memberRoles.includes(r)) ?? false;
            if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });
        }
        
        let dbSettings = await db.feedbackSettings.findUnique({ where: { guildId } });
        if (!dbSettings) {
            // Create default
             dbSettings = await db.feedbackSettings.create({
                 data: { guildId, enabled: false }
             });
        }
        res.json(dbSettings);
    } catch (e) {
        logger.error('Feedback settings fetch', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Update Feedback Settings
app.post('/api/feedback/settings/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        // Allow if admin OR user can access the plugin page (via accessiblePlugins)
        const user = req.session.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        const isAdmin = isTrueAdmin(guildId, req);
        if (!isAdmin) {
            // Check if user has any role that grants plugin access
            const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${user.id}`, {
                headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                timeout: 5000
            }).catch(() => ({ data: { roles: [] } }));
            const memberRoles = memberRes.data.roles || [];
            
            // Check plugin settings for allowed roles
            const settings = await db.pluginSettings.findUnique({
                where: { guildId_pluginId: { guildId, pluginId: 'production-feedback' } }
            });
            const hasAccess = settings?.allowedRoles?.some((r: string) => memberRoles.includes(r)) ?? false;
            if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });
        }

        const { enabled, forumChannelId, reviewChannelId, modLogChannelId, feedbackPointsReward, feedbackPointsCost, aiModel, approverRoleIds } = req.body;

        // Validate integer fields — floats or NaN from the frontend cause a Prisma type error
        if (feedbackPointsReward !== undefined) {
            const r = Math.trunc(Number(feedbackPointsReward));
            if (!Number.isFinite(r) || r < 0) return res.status(400).json({ error: 'feedbackPointsReward must be a non-negative integer' });
        }
        if (feedbackPointsCost !== undefined) {
            const c = Math.trunc(Number(feedbackPointsCost));
            if (!Number.isFinite(c) || c < 0) return res.status(400).json({ error: 'feedbackPointsCost must be a non-negative integer' });
        }

        const allowedData: any = {};
        if (enabled !== undefined) allowedData.enabled = Boolean(enabled);
        // Convert empty strings to null for optional channel/role ID fields
        if (forumChannelId !== undefined) allowedData.forumChannelId = forumChannelId || null;
        if (reviewChannelId !== undefined) allowedData.reviewChannelId = reviewChannelId || null;
        if (modLogChannelId !== undefined) allowedData.modLogChannelId = modLogChannelId || null;
        if (feedbackPointsReward !== undefined) allowedData.feedbackPointsReward = Math.trunc(Number(feedbackPointsReward));
        if (feedbackPointsCost !== undefined) allowedData.feedbackPointsCost = Math.trunc(Number(feedbackPointsCost));
        if (aiModel !== undefined) allowedData.aiModel = aiModel;
        if (approverRoleIds !== undefined) allowedData.approverRoleIds = Array.isArray(approverRoleIds) ? approverRoleIds : [];

        const updated = await db.feedbackSettings.upsert({
            where: { guildId },
            create: { guildId, ...allowedData },
            update: allowedData
        });
        res.json(updated);
    } catch (e: any) {
        logger.error('Feedback settings update', e);
        res.status(500).json({ error: e?.message ?? 'Failed to save settings' });
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
             // 1. Update DB + reward atomically with feedback points
             const settings = await db.feedbackSettings.findUnique({ where: { guildId } });
             await db.$transaction(async (tx) => {
                 await tx.feedbackPost.update({ where: { id: postId }, data: { aiState: 'APPROVED' } });
                 if (settings && settings.feedbackPointsReward > 0) {
                     await tx.feedbackPoints.upsert({
                         where: { guildId_userId: { guildId, userId: post.userId } },
                         update: { balance: { increment: settings.feedbackPointsReward }, totalEarned: { increment: settings.feedbackPointsReward } },
                         create: { guildId, userId: post.userId, balance: settings.feedbackPointsReward, totalEarned: settings.feedbackPointsReward }
                     });
                     await tx.feedbackPointsTransaction.create({
                         data: {
                             guildId,
                             userId: post.userId,
                             amount: settings.feedbackPointsReward,
                             type: 'EARNED_FEEDBACK',
                             reason: 'Staff approved feedback'
                         }
                     });
                 }
             });

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

            // Reward already handled in transaction above

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
                        ? (user.avatar.startsWith('http') ? user.avatar : `https://cdn.discordapp.com/avatars/${post.userId}/${user.avatar}.png`)
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


// Feedback Points — User Search (enrich with FeedbackPoints balance)
app.get('/api/feedback/search-users/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { q } = req.query;
        if (!await checkPluginAccess(guildId, req, 'production-feedback')) return res.status(403).json({ error: 'Forbidden' });
        if (!q || String(q).length < 2) return res.json([]);

        const searchRes = await axios.get(
            `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(String(q))}&limit=10`,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
        );
        const results = await Promise.all(searchRes.data.map(async (member: any) => {
            const fp = await db.feedbackPoints.findUnique({
                where: { guildId_userId: { guildId, userId: member.user.id } }
            });
            return { ...member, balance: fp?.balance ?? 0, totalEarned: fp?.totalEarned ?? 0 };
        }));
        res.json(results);
    } catch (e: any) {
        logger.error('Feedback user search failed', e);
        res.json([]);
    }
});

// Feedback Points — Leaderboard (top 10 by balance)
app.get('/api/feedback/leaderboard/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'production-feedback')) return res.status(403).json({ error: 'Forbidden' });

        const top = await db.feedbackPoints.findMany({
            where: { guildId },
            orderBy: { balance: 'desc' },
            take: 10,
        });
        const enriched = await Promise.all(top.map(async (fp) => {
            try {
                const { data: u } = await axios.get(`https://discord.com/api/v10/users/${fp.userId}`, {
                    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
                });
                return { userId: fp.userId, username: u.username, avatar: u.avatar, balance: fp.balance, totalEarned: fp.totalEarned };
            } catch {
                return { userId: fp.userId, username: 'Unknown User', avatar: null, balance: fp.balance, totalEarned: fp.totalEarned };
            }
        }));
        res.json(enriched);
    } catch (e: any) {
        logger.error('Feedback leaderboard failed', e);
        res.status(500).json({ error: e?.message ?? 'Failed' });
    }
});

// Feedback Points — Single user detail + transaction history
app.get('/api/feedback/user/:guildId/:userId', async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'production-feedback')) return res.status(403).json({ error: 'Forbidden' });

        const fp = await db.feedbackPoints.findUnique({ where: { guildId_userId: { guildId, userId } } });
        const history = await db.feedbackPointsTransaction.findMany({
            where: { guildId, userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        res.json({ balance: fp?.balance ?? 0, totalEarned: fp?.totalEarned ?? 0, history });
    } catch (e: any) {
        logger.error('Feedback user detail failed', e);
        res.status(500).json({ error: e?.message ?? 'Failed' });
    }
});

// Feedback Points — Admin vault (set or give points)
app.post('/api/feedback/vault/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden — admin only' });

        const { userId, amount, mode } = req.body; // mode: 'set' | 'add'
        if (!userId || !mode) return res.status(400).json({ error: 'userId and mode are required' });

        const safeAmount = Math.trunc(Number(amount));
        if (!Number.isFinite(safeAmount)) return res.status(400).json({ error: 'amount must be a finite number' });

        const existing = await db.feedbackPoints.findUnique({ where: { guildId_userId: { guildId, userId } } });
        const newBalance = mode === 'set' ? safeAmount : Math.max(0, (existing?.balance ?? 0) + safeAmount);

        const updated = await db.$transaction(async (tx: any) => {
            const fp = await tx.feedbackPoints.upsert({
                where: { guildId_userId: { guildId, userId } },
                update: { balance: newBalance, ...(mode === 'add' && safeAmount > 0 ? { totalEarned: { increment: safeAmount } } : {}) },
                create: { guildId, userId, balance: newBalance, totalEarned: Math.max(0, newBalance) },
            });
            await tx.feedbackPointsTransaction.create({
                data: {
                    guildId,
                    userId,
                    amount: mode === 'set' ? (newBalance - (existing?.balance ?? 0)) : safeAmount,
                    type: 'BONUS',
                    reason: `Admin ${mode === 'set' ? 'set' : 'gave'} ${Math.abs(safeAmount)} points via dashboard`,
                },
            });
            return fp;
        });
        res.json(updated);
    } catch (e: any) {
        logger.error('Feedback vault update failed', e);
        res.status(500).json({ error: e?.message ?? 'Failed' });
    }
});

// In-memory store for verify-all background jobs
type VerifyJobStatus = { status: 'running' | 'done' | 'error'; verified: number; failed: number; total: number; error?: string };
const verifyAllJobs = new Map<string, VerifyJobStatus>();

// --- Welcome Gate Routes ---
app.get('/api/guilds/:guildId/welcome', async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

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
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/guilds/:guildId/welcome', async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { enabled, welcomeChannelId, unverifiedRoleId, verifiedRoleId, modalTitle, questions, logChannelId, departureChannelId, arrivalChannelId, whitelistedChannelIds } = req.body;
        
        const settings = await db.welcomeGateSettings.upsert({
            where: { guildId },
            create: {
                guildId,
                enabled,
                welcomeChannelId,
                unverifiedRoleId,
                verifiedRoleId,
                modalTitle,
                questions,
                logChannelId,
                departureChannelId,
                arrivalChannelId,
                whitelistedChannelIds: whitelistedChannelIds ?? [],
            },
            update: {
                enabled,
                welcomeChannelId,
                unverifiedRoleId,
                verifiedRoleId,
                modalTitle,
                questions,
                logChannelId,
                departureChannelId,
                arrivalChannelId,
                whitelistedChannelIds: whitelistedChannelIds ?? [],
            }
        });
        
        res.json(settings);
    } catch (e) {
        logger.error('Failed to update welcome settings', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Apply channel permissions � deny ViewChannel for unverified role on all channels except whitelist
app.post('/api/guilds/:guildId/welcome/apply-permissions', async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    const settings = await db.welcomeGateSettings.findUnique({ where: { guildId } });
    if (!settings || !settings.unverifiedRoleId) {
        return res.status(400).json({ error: 'Unverified role must be configured first.' });
    }

    const botToken = process.env.DISCORD_TOKEN;
    const discordBase = 'https://discord.com/api/v10';
    const headers = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };

    // Build the set of channels unverified users are allowed to see
    const allowed = new Set<string>([
        ...(settings.whitelistedChannelIds ?? []),
        ...(settings.welcomeChannelId ? [settings.welcomeChannelId] : []),
    ]);

    try {
        const { data: channels } = await axios.get(`${discordBase}/guilds/${guildId}/channels`, { headers });

        // Auto-whitelist parent categories of allowed channels so children remain visible
        for (const ch of channels) {
            if (allowed.has(ch.id) && ch.parent_id) {
                allowed.add(ch.parent_id);
            }
        }

        logger.info(`[Apply-Perms] Guild ${guildId}: allowed set (${allowed.size}): ${JSON.stringify([...allowed])}`);

        let applied = 0;
        let skipped = 0;

        for (const channel of channels) {
            // Process text, voice, announcement, stage, forum, media channels and categories
            if (![0, 2, 4, 5, 13, 15, 16].includes(channel.type)) continue;

            const VIEW_CHANNEL = '1024';

            try {
                if (allowed.has(channel.id)) {
                    await axios.put(
                        `${discordBase}/channels/${channel.id}/permissions/${settings.unverifiedRoleId}`,
                        { allow: VIEW_CHANNEL, deny: '0', type: 0 },
                        { headers }
                    );
                } else {
                    await axios.put(
                        `${discordBase}/channels/${channel.id}/permissions/${settings.unverifiedRoleId}`,
                        { allow: '0', deny: VIEW_CHANNEL, type: 0 },
                        { headers }
                    );
                }
                applied++;
            } catch (e: any) {
                if (e.response?.status === 429) {
                    const retryAfter = (e.response.data?.retry_after ?? 1) * 1000;
                    await new Promise(r => setTimeout(r, retryAfter + 100));
                    try {
                        if (allowed.has(channel.id)) {
                            await axios.put(`${discordBase}/channels/${channel.id}/permissions/${settings.unverifiedRoleId}`, { allow: VIEW_CHANNEL, deny: '0', type: 0 }, { headers });
                        } else {
                            await axios.put(`${discordBase}/channels/${channel.id}/permissions/${settings.unverifiedRoleId}`, { allow: '0', deny: VIEW_CHANNEL, type: 0 }, { headers });
                        }
                        applied++;
                    } catch { skipped++; }
                } else {
                    skipped++;
                }
            }
            await new Promise(r => setTimeout(r, 150));
        }

        // Post-apply verification: read back overwrites on whitelisted channels
        const verifyIds = [...(settings.whitelistedChannelIds ?? [])].slice(0, 5);
        const verified: string[] = [];
        const failed: string[] = [];
        for (const vId of verifyIds) {
            try {
                const { data: ch } = await axios.get(`${discordBase}/channels/${vId}`, { headers });
                const ow = (ch.permission_overwrites || []).find((o: any) => o.id === settings.unverifiedRoleId);
                if (ow && (BigInt(ow.allow) & 1024n)) {
                    verified.push(ch.name);
                } else {
                    failed.push(ch.name || vId);
                }
            } catch { failed.push(vId); }
            await new Promise(r => setTimeout(r, 150));
        }

        logger.info(`Apply-permissions for guild ${guildId}: ${applied} channels updated, ${skipped} skipped. Verified: ${verified.length}/${verifyIds.length} (${verified.join(', ')}). Failed: ${failed.join(', ') || 'none'}`);
        res.json({ success: true, applied, skipped, verified, failed });
    } catch (e: any) {
        logger.error('Failed to apply channel permissions', e);
        res.status(500).json({ error: 'Failed to apply permissions' });
    }
});

// Diagnostic: show which channels the unverified role can/cannot see
app.get('/api/guilds/:guildId/welcome/permission-diagnostic', async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    const settings = await db.welcomeGateSettings.findUnique({ where: { guildId } });
    if (!settings || !settings.unverifiedRoleId) {
        return res.status(400).json({ error: 'Unverified role must be configured first.' });
    }

    const botToken = process.env.DISCORD_TOKEN;
    const discordBase = 'https://discord.com/api/v10';
    const hdrs = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };

    try {
        const [{ data: channels }, { data: guild }] = await Promise.all([
            axios.get(`${discordBase}/guilds/${guildId}/channels`, { headers: hdrs }),
            axios.get(`${discordBase}/guilds/${guildId}`, { headers: hdrs }),
        ]);

        const everyonePerms = BigInt(guild.roles.find((r: any) => r.id === guildId)?.permissions || '0');
        const unvPerms = BigInt(guild.roles.find((r: any) => r.id === settings.unverifiedRoleId)?.permissions || '0');
        const basePerms = everyonePerms | unvPerms;

        const visible: { id: string; name: string; type: number; category: string | null }[] = [];
        const hidden: { id: string; name: string; type: number; category: string | null }[] = [];

        for (const ch of channels) {
            if (![0, 2, 5, 13, 15, 16].includes(ch.type)) continue;

            const overwrites = ch.permission_overwrites || [];
            let perms = basePerms;

            // @everyone channel overwrite
            const evOW = overwrites.find((o: any) => o.id === guildId);
            if (evOW) perms = (perms & ~BigInt(evOW.deny)) | BigInt(evOW.allow);

            // Unverified role overwrite
            const unvOW = overwrites.find((o: any) => o.id === settings.unverifiedRoleId);
            if (unvOW) perms = (perms & ~BigInt(unvOW.deny)) | BigInt(unvOW.allow);

            const parentCh = channels.find((c: any) => c.id === ch.parent_id);
            const entry = { id: ch.id, name: ch.name, type: ch.type, category: parentCh?.name || null };

            if (perms & 1024n) {
                visible.push(entry);
            } else {
                hidden.push(entry);
            }
        }

        res.json({ visible, hidden: hidden.length, whitelisted: settings.whitelistedChannelIds?.length || 0 });
    } catch (e: any) {
        logger.error('Permission diagnostic failed', e);
        res.status(500).json({ error: 'Failed to run diagnostic' });
    }
});

// Immediately verify all unverified members in the guild
app.post('/api/guilds/:guildId/welcome/verify-all', async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    // If a job is already running for this guild, return its id
    if (verifyAllJobs.get(guildId)?.status === 'running') {
        return res.json({ jobId: guildId, status: 'running' });
    }

    const settings = await db.welcomeGateSettings.findUnique({ where: { guildId } });
    if (!settings || !settings.unverifiedRoleId || !settings.verifiedRoleId) {
        return res.status(400).json({ error: 'Unverified and Verified roles must be configured first.' });
    }

    // Kick off background job
    verifyAllJobs.set(guildId, { status: 'running', verified: 0, failed: 0, total: 0 });
    res.json({ jobId: guildId, status: 'running' });

    // Run asynchronously � don't await
    (async () => {
        logger.info(`Verify-all job started for guild ${guildId}`);
        const botToken = process.env.DISCORD_TOKEN;
        const discordBase = 'https://discord.com/api/v10';
        const headers = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };

        const patchMemberRoles = async (userId: string, roles: string[]): Promise<void> => {
            while (true) {
                try {
                    await axios.patch(`${discordBase}/guilds/${guildId}/members/${userId}`, { roles }, { headers });
                    return;
                } catch (err: any) {
                    if (err.response?.status === 429) {
                        const retryAfter = (err.response.data?.retry_after ?? 1) * 1000;
                        await new Promise(r => setTimeout(r, retryAfter + 200));
                    } else {
                        throw err;
                    }
                }
            }
        };

        try {
            let members: any[] = [];
            let after = '0';
            let pageCount = 0;
            while (true) {
                const resp = await axios.get(
                    `${discordBase}/guilds/${guildId}/members?limit=1000&after=${after}`,
                    { headers, timeout: 15000 }
                );
                const batch = resp.data;
                logger.info(`Verify-all guild ${guildId}: page ${++pageCount}, got ${Array.isArray(batch) ? batch.length : 'non-array'}`);
                // Guard: Discord returns an error object (not array) if permissions are missing
                if (!Array.isArray(batch) || batch.length === 0) break;
                members = members.concat(batch);
                if (batch.length < 1000) break;
                const lastId = batch[batch.length - 1]?.user?.id;
                if (!lastId || lastId === after) {
                    logger.warn(`Verify-all guild ${guildId}: pagination stalled at after=${after}, stopping`);
                    break;
                }
                after = lastId;
            }

            logger.info(`Verify-all guild ${guildId}: fetched ${members.length} total members`);

            // Target members who have NEITHER the verified role NOR the unverified role
            // (stuck in limbo from previous partial runs or joined before the gate was set up).
            // Also include members who still have the unverified role (normal pending members).
            const toVerify = members.filter(m =>
                !m.user.bot &&
                Array.isArray(m.roles) &&
                !m.roles.includes(settings.verifiedRoleId) &&
                !m.roles.includes(settings.unverifiedRoleId)
            );

            logger.info(`Verify-all guild ${guildId}: ${toVerify.length} members have neither role (verifiedRole=${settings.verifiedRoleId}, unverifiedRole=${settings.unverifiedRoleId})`);

            const job = verifyAllJobs.get(guildId)!;
            job.total = toVerify.length;

            for (const m of toVerify) {
                const updatedRoles = [
                    ...m.roles.filter((r: string) => r !== settings.unverifiedRoleId),
                    settings.verifiedRoleId,
                ];
                try {
                    await patchMemberRoles(m.user.id, updatedRoles);
                    job.verified++;
                } catch (e: any) {
                    logger.warn(`Verify-all: failed to patch ${m.user.id}: ${e.response?.status} ${e.message}`);
                    job.failed++;
                }
                // 300ms base pace � 429 retry handler will back off if needed
                await new Promise(r => setTimeout(r, 300));
            }

            job.status = 'done';
            logger.info(`Verify-all for guild ${guildId}: verified ${job.verified}, failed ${job.failed}`);
        } catch (e: any) {
            const job = verifyAllJobs.get(guildId);
            if (job) { job.status = 'error'; job.error = e.message; }
            logger.error('Verify-all background job failed', e);
        }
    })();
});

// Poll verify-all job status
app.get('/api/guilds/:guildId/welcome/verify-all/status', async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    const job = verifyAllJobs.get(guildId);
    if (!job) return res.json({ status: 'idle' });
    res.json(job);
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










app.post('/api/bot/identity', requireAdmin, async (req, res) => {
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
app.get('/api/email/attachment/:filename', requireAdmin, (req: any, res) => {
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

        if (settings.webhookSecret) {
            const secret = settings.webhookSecret;
            const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

            if (secret.startsWith('whsec_')) {
                // Resend HMAC signature verification
                const svixId = req.headers['svix-id'] as string;
                const svixTimestamp = req.headers['svix-timestamp'] as string;
                const svixSignature = req.headers['svix-signature'] as string;

                if (!svixId || !svixTimestamp || !svixSignature) {
                    logger.warn(`[Email Webhook] Missing Resend signature headers from ${req.ip}`);
                    return res.status(401).json({ error: 'Unauthorized' });
                }

                const keyBytes = Buffer.from(secret.replace('whsec_', ''), 'base64');
                const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
                const hmac = crypto.createHmac('sha256', keyBytes).update(toSign).digest('base64');
                const expectedSig = `v1,${hmac}`;
                const signatures = svixSignature.split(' ');
                const valid = signatures.some(sig => sig === expectedSig);

                if (!valid) {
                    logger.warn(`[Email Webhook] Invalid Resend signature from ${req.ip}`);
                    return res.status(401).json({ error: 'Unauthorized' });
                }
            } else {
                // Simple x-auth-token bearer check (other providers)
                const token = req.headers['x-auth-token'];
                if (typeof token !== 'string' ||
                    token.length !== secret.length ||
                    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
                    logger.warn(`[Email Webhook] Unauthorized attempt from ${req.ip}`);
                    return res.status(401).json({ error: 'Unauthorized' });
                }
            }
        }

        // Parse request body � express.text() always gives us a string
        let bodyObj: any = null;
        if (typeof req.body === 'string') {
            try { bodyObj = JSON.parse(req.body); } catch {}
        } else if (req.body && typeof req.body === 'object') {
            bodyObj = req.body;
        }

        const threadId = `live_${Date.now()}`;
        let parsedSubject = '(No Subject)';
        let parsedFrom = 'Unknown';
        let parsedFromEmail = 'unknown@example.com';
        let parsedToEmail = '';
        let parsedBody = '';
        let parsedMessageId: string | undefined;
        let parsedInReplyTo: string | undefined;
        let parsedReferences: string[] = [];
        const savedAttachments: Array<{ filename: string; path: string }> = [];

        // Resend inbound format: { type: "email.received", data: { email_id, from, to, subject, ... } }
        // Body is NOT included in the webhook � must be fetched via Resend API using email_id
        const resendData = bodyObj?.data || (bodyObj?.type === 'email.received' ? bodyObj : null);
        if (resendData?.email_id !== undefined || resendData?.from !== undefined) {
            logger.info(`[Email Webhook] Detected Resend structured format, email_id: ${resendData.email_id}`);
            parsedSubject = resendData.subject || '(No Subject)';
            parsedFrom = resendData.from || 'Unknown';
            const fromMatch = (resendData.from || '').match(/<(.+?)>/);
            parsedFromEmail = fromMatch ? fromMatch[1] : (resendData.from || 'unknown@example.com');
            const toList = Array.isArray(resendData.to) ? resendData.to : [resendData.to];
            parsedToEmail = toList[0] || '';
            parsedMessageId = resendData.message_id || resendData.messageId;

            // Fetch full email body from Resend API using email_id
            if (resendData.email_id) {
                try {
                    const resendApiKey = process.env.RESEND_API_KEY;
                    const emailRes = await axios.get(`https://api.resend.com/emails/${resendData.email_id}`, {
                        headers: { Authorization: `Bearer ${resendApiKey}` }
                    });
                    const fullEmail = emailRes.data;
                    parsedBody = fullEmail.html || fullEmail.text || '';
                    parsedInReplyTo = fullEmail.headers?.['in-reply-to'] || fullEmail.reply_to?.[0] || '';
                    logger.info(`[Email Webhook] Fetched full email body, length: ${parsedBody.length}`);
                } catch (fetchErr: any) {
                    logger.error(`[Email Webhook] Failed to fetch full email from Resend: ${fetchErr?.message}`);
                }
            }
        } else {
            // Fall back to raw MIME parsing (for other providers)
            let rawEmail = '';
            if (typeof req.body === 'string' && !bodyObj) {
                rawEmail = req.body;
            } else if (bodyObj) {
                rawEmail = bodyObj.raw || bodyObj.body || bodyObj.email || '';
            }

            if (!rawEmail) {
                logger.error('[Email Webhook] No email body found in request');
                return res.status(400).json({ error: 'No email body found' });
            }

            logger.info(`[Email Webhook] Parsing raw MIME email... Size: ${rawEmail.length} bytes`);
            const parsed = await simpleParser(rawEmail);
            logger.info(`[Email Webhook] Parsed: ${parsed.subject} from ${parsed.from?.text}`);

            parsedSubject = parsed.subject || '(No Subject)';
            parsedFrom = parsed.from?.text || 'Unknown';
            parsedFromEmail = parsed.from?.value?.[0]?.address || 'unknown@example.com';
            parsedToEmail = parsed.to && Array.isArray(parsed.to) ? (parsed.to[0] as any).text : (parsed.to as any)?.text || '';
            parsedBody = parsed.html || parsed.textAsHtml || parsed.text || '';
            parsedMessageId = parsed.messageId;
            parsedInReplyTo = parsed.inReplyTo;
            parsedReferences = Array.isArray(parsed.references) ? parsed.references : (parsed.references ? [parsed.references] : []);

            // Handle Attachments (raw MIME only)
            const attachmentsDir = path.join(process.cwd(), 'data', 'attachments');
            if (!fs.existsSync(attachmentsDir)) {
                fs.mkdirSync(attachmentsDir, { recursive: true });
            }
            if (parsed.attachments && parsed.attachments.length > 0) {
                for (const att of parsed.attachments) {
                    const safeName = (att.filename || 'attachment').replace(/[^a-z0-9.]/gi, '_');
                    const fileName = `${threadId}_${safeName}`;
                    const filePath = path.join(attachmentsDir, fileName);
                    fs.writeFileSync(filePath, att.content);
                    savedAttachments.push({ filename: att.filename || 'attachment', path: fileName });
                }
            }
        }

        const newEmail = {
            threadId,
            from: parsedFrom,
            fromEmail: parsedFromEmail,
            toEmail: parsedToEmail,
            subject: parsedSubject,
            body: parsedBody,
            date: new Date().toISOString(),
            category: 'inbox' as const,
            read: false,
            notified: false,
            messageId: parsedMessageId,
            inReplyTo: parsedInReplyTo,
            references: parsedReferences,
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
const emailUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
app.post('/api/email/send', requireAdmin, emailUpload.array('attachments'), async (req, res) => {
    
    try {
        const settings = await emailService.getSettings();
        const resendApiKey = settings.resendApiKey || process.env.RESEND_API_KEY;
        if (!resendApiKey) return res.status(400).json({ error: 'Resend API Key not configured' });

        const { to, subject, body, replyTo, inReplyTo, references } = req.body;
        const resend = new Resend(resendApiKey);

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

        if (error) throw new Error((error as any).message || JSON.stringify(error));

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

    } catch (e: any) {
        logger.error('Send email error', e);
        res.status(500).json({ error: e?.message || 'Failed to send email' });
    }
});

// List Emails
app.get('/api/email/list/:category?', requireAdmin, async (req, res) => {
    const category = req.params.category || 'inbox';
    const emails = await emailService.getEmails(category);
    res.json(emails);
});

// Get Thread
app.get('/api/email/thread', requireAdmin, async (req, res) => {
    const subject = req.query.subject as string;
    if (!subject) return res.status(400).json({ error: 'Subject required' });
    
    const thread = await emailService.getThread(subject);
    res.json(thread);
});

// Update Email
app.patch('/api/email/:threadId', requireAdmin, async (req, res) => {
    const { updates } = req.body;
    await emailService.updateEmail(req.params.threadId, updates);
    res.json({ success: true });
});

// Get Settings
app.get('/api/email/settings', requireAdmin, async (req, res) => {
    const settings = await emailService.getSettings();
    // Mask API Key
    if (settings.resendApiKey) settings.resendApiKey = 're_...' + settings.resendApiKey.slice(-4);
    res.json(settings);
});

// Update Settings
app.post('/api/email/settings', requireAdmin, async (req, res) => {
    const { webhookSecret, channelId, roleId, resendApiKey, fromName, fromEmail } = req.body;
    const updates: any = {};
    if (webhookSecret !== undefined) updates.webhookSecret = webhookSecret;
    if (channelId !== undefined) updates.channelId = channelId;
    if (roleId !== undefined) updates.roleId = roleId;
    if (fromName !== undefined) updates.fromName = fromName;
    if (fromEmail !== undefined) updates.fromEmail = fromEmail;
    
    // If updating key, ensure we don't save the masked version
    if (resendApiKey && !resendApiKey.startsWith('re_...')) {
        updates.resendApiKey = resendApiKey;
    }
    
    await emailService.updateSettings(updates);
    res.json({ success: true });
});

// --- Bot Messenger Endpoints ---

// Fetch recent messages from a channel
app.get('/api/bot-messenger/:guildId/messages/:channelId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId, channelId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    try {
        const params: any = { limit };
        if (before) params.before = before;
        const qs = new URLSearchParams(params as any).toString();
        const response = await discordReq('get', `/channels/${channelId}/messages?${qs}`);
        res.json(response.data);
    } catch (err: any) {
        logger.error('Failed to fetch channel messages', err);
        res.status(err.response?.status || 500).json({ error: 'Failed to fetch messages' });
    }
});

// Send a message to a channel (text or embed)
app.post('/api/bot-messenger/:guildId/send', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    const { channelId, content, embeds, replyTo, stickerId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'channelId is required' });
    if (!content && (!embeds || embeds.length === 0) && !stickerId) {
        return res.status(400).json({ error: 'Message must have content, embeds, or a sticker' });
    }

    try {
        const payload: any = {};
        if (content) payload.content = content;
        if (embeds && embeds.length > 0) payload.embeds = embeds;
        if (stickerId) payload.sticker_ids = [stickerId];
        if (replyTo) {
            payload.message_reference = { message_id: replyTo, fail_if_not_exists: false };
        }
        const response = await discordReq('post', `/channels/${channelId}/messages`, payload);
        res.json(response.data);
    } catch (err: any) {
        logger.error('Failed to send message via messenger', err);
        res.status(err.response?.status || 500).json({ error: err.response?.data?.message || 'Failed to send message' });
    }
});

// React to a message
app.post('/api/bot-messenger/:guildId/react', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    const { channelId, messageId, emoji } = req.body;
    if (!channelId || !messageId || !emoji) {
        return res.status(400).json({ error: 'channelId, messageId, and emoji are required' });
    }

    try {
        // Normalise emoji for Discord's reaction endpoint:
        // - Custom emoji arrives as "<:name:id>" or "<a:name:id>" ? strip to "name:id"
        // - Unicode emoji arrives as raw character (e.g. "??") ? use as-is
        const customMatch = emoji.match(/^<a?:([^:]+):(\d+)>$/);
        const normalised = customMatch ? `${customMatch[1]}:${customMatch[2]}` : emoji;
        const encoded = encodeURIComponent(normalised);
        await discordReq('put', `/channels/${channelId}/messages/${messageId}/reactions/${encoded}/@me`);
        res.json({ success: true });
    } catch (err: any) {
        logger.error('Failed to add reaction', err);
        res.status(err.response?.status || 500).json({ error: err.response?.data?.message || 'Failed to react' });
    }
});

// Fetch guild stickers
app.get('/api/bot-messenger/:guildId/stickers', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const response = await discordReq('get', `/guilds/${guildId}/stickers`);
        res.json(response.data);
    } catch (err: any) {
        logger.error('Failed to fetch guild stickers', err);
        res.status(err.response?.status || 500).json({ error: 'Failed to fetch stickers' });
    }
});

// Upload an image for embed use � returns full-size CDN URL + auto-generated thumbnail
app.post('/api/bot-messenger/:guildId/upload-image', upload.single('embedImage'), async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image uploaded' });

    try {
        await scanFileForViruses(file.path, 'embedImage');

        const sharp = (await import('sharp')).default;
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.filename, path.extname(file.filename));

        // Generate thumbnail BEFORE uploading full-size (uploadToR2OrLocal deletes local file)
        const thumbBuffer = await sharp(file.path)
            .resize(200, null, { withoutEnlargement: true })
            .toBuffer();

        // Full-size image � upload to R2
        const imageKey = `embed-images/${baseName}${ext}`;
        const imageUrl = await uploadToR2OrLocal(
            file.path,
            imageKey,
            file.mimetype,
            `/uploads/embed-images/${file.filename}`
        );

        // Upload thumbnail
        const thumbKey = `embed-images/${baseName}_thumb${ext}`;
        let thumbnailUrl: string;
        if (R2Storage.isConfigured()) {
            thumbnailUrl = await R2Storage.uploadBuffer(thumbKey, thumbBuffer, file.mimetype);
        } else {
            const thumbDir = path.join(PROJECT_ROOT, 'public/uploads/embed-images');
            if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
            const thumbPath = path.join(thumbDir, `${baseName}_thumb${ext}`);
            fs.writeFileSync(thumbPath, thumbBuffer);
            thumbnailUrl = `/uploads/embed-images/${baseName}_thumb${ext}`;
        }

        res.json({ imageUrl, thumbnailUrl });
    } catch (err: any) {
        if (err.message?.startsWith('Uploaded file was rejected')) {
            return res.status(400).json({ error: err.message });
        }
        logger.error('Embed image upload failed', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Create a new post (thread) in a forum channel
app.post('/api/bot-messenger/:guildId/forum-post', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    const { forumChannelId, title, content, embeds } = req.body;
    if (!forumChannelId) return res.status(400).json({ error: 'forumChannelId is required' });
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
    if (!content && (!embeds || embeds.length === 0)) return res.status(400).json({ error: 'Post must have content or embeds' });

    try {
        const message: any = {};
        if (content) message.content = content;
        if (embeds && embeds.length > 0) message.embeds = embeds;
        const response = await discordReq('post', `/channels/${forumChannelId}/threads`, { name: title.trim(), message });
        res.json(response.data);
    } catch (err: any) {
        logger.error('Failed to create forum post', err);
        res.status(err.response?.status || 500).json({ error: err.response?.data?.message || 'Failed to create post' });
    }
});

// List active threads in a forum channel
app.get('/api/bot-messenger/:guildId/forum-threads/:channelId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId, channelId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const response = await discordReq('get', `/guilds/${guildId}/threads/active`);
        const threads = (response.data.threads || []).filter((t: any) => t.parent_id === channelId);
        res.json(threads);
    } catch (err: any) {
        logger.error('Failed to fetch forum threads', err);
        res.status(err.response?.status || 500).json({ error: 'Failed to fetch threads' });
    }
});

// --- Reaction Roles (Bot Messenger) ----------------------------------------

// GET all reaction roles for a guild
app.get('/api/bot-messenger/:guildId/reaction-roles', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const roles = await db.reactionRole.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } });
        res.json(roles);
    } catch (e) {
        logger.error('GET reaction-roles', e);
        res.status(500).json({ error: 'Failed to load reaction roles' });
    }
});

// POST create a reaction role + add the bot's reaction to the message
app.post('/api/bot-messenger/:guildId/reaction-roles', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    const { channelId, messageId, emoji, roleId } = req.body;
    if (!channelId || !messageId || !emoji || !roleId) return res.status(400).json({ error: 'Missing required fields' });
    try {
        // Make the bot react on the target message so users can click it
        try {
            const reactEmoji = emoji.includes(':') ? emoji : encodeURIComponent(emoji);
            await discordReq('put', `/channels/${channelId}/messages/${messageId}/reactions/${reactEmoji}/@me`);
        } catch (err: any) {
            logger.warn('Could not add bot reaction (message may not exist)', err?.message);
        }
        const rr = await db.reactionRole.create({ data: { guildId, channelId, messageId, emoji, roleId } });
        res.json(rr);
    } catch (e: any) {
        if (e?.code === 'P2002') return res.status(409).json({ error: 'That emoji is already mapped on this message' });
        logger.error('POST reaction-role', e);
        res.status(500).json({ error: 'Failed to create reaction role' });
    }
});

// DELETE a reaction role
app.delete('/api/bot-messenger/:guildId/reaction-roles/:id', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId, id } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const rr = await db.reactionRole.findFirst({ where: { id, guildId } });
        if (!rr) return res.status(404).json({ error: 'Not found' });
        // Try to remove the bot's reaction from the message
        try {
            const reactEmoji = rr.emoji.includes(':') ? rr.emoji : encodeURIComponent(rr.emoji);
            await discordReq('delete', `/channels/${rr.channelId}/messages/${rr.messageId}/reactions/${reactEmoji}/@me`);
        } catch (err: any) {
            logger.warn('Could not remove bot reaction', err?.message);
        }
        await db.reactionRole.delete({ where: { id } });
        res.json({ success: true });
    } catch (e) {
        logger.error('DELETE reaction-role', e);
        res.status(500).json({ error: 'Failed to delete reaction role' });
    }
});

// GET guild roles (for the reaction role role picker)
app.get('/api/bot-messenger/:guildId/roles', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const response = await discordReq('get', `/guilds/${guildId}/roles`);
        const roles = (response.data || [])
            .filter((r: any) => r.name !== '@everyone' && !r.managed)
            .sort((a: any, b: any) => b.position - a.position)
            .map((r: any) => ({ id: r.id, name: r.name, color: r.color }));
        res.json(roles);
    } catch (err: any) {
        logger.error('Failed to fetch guild roles', err);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});

// --- Auto Messages Endpoints -----------------------------------------------

// GET: list all schedules for a guild
app.get('/api/auto-messages/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const schedules = await db.autoMessageSchedule.findMany({
            where: { guildId },
            include: { messages: { orderBy: { position: 'asc' } } },
            orderBy: { createdAt: 'asc' },
        });
        res.json(schedules);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// POST: create a new schedule
app.post('/api/auto-messages/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    const { name } = req.body;
    try {
        await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
        const schedule = await db.autoMessageSchedule.create({
            data: { guildId, name: (name || 'New Schedule').slice(0, 100) },
            include: { messages: true },
        });
        res.json(schedule);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// PUT: update a schedule (config + full message replace)
app.put('/api/auto-messages/:guildId/:scheduleId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId, scheduleId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    const { name, channelId, intervalMinutes, enabled, messages } = req.body;
    const interval = Math.max(1, Math.min(10080, parseInt(intervalMinutes) || 60));
    const msgs: { content: string; position: number }[] = (Array.isArray(messages) ? messages : [])
        .filter((m: any) => typeof m.content === 'string' && m.content.trim().length > 0)
        .slice(0, 50)
        .map((m: any, i: number) => ({ content: m.content.trim().slice(0, 2000), position: i }));

    try {
        // Verify schedule belongs to this guild
        const existing = await db.autoMessageSchedule.findFirst({ where: { id: scheduleId, guildId } });
        if (!existing) return res.status(404).json({ error: 'Schedule not found' });

        await db.autoMessageSchedule.update({
            where: { id: scheduleId },
            data: {
                name: name ? name.slice(0, 100) : existing.name,
                channelId: channelId || null,
                intervalMinutes: interval,
                enabled: !!enabled,
                // Reset index if messages shrank past current position
                currentIndex: msgs.length > 0 ? existing.currentIndex % msgs.length : 0,
            },
        });

        // Replace all messages atomically
        await db.autoMessageEntry.deleteMany({ where: { scheduleId } });
        if (msgs.length > 0) {
            await db.autoMessageEntry.createMany({
                data: msgs.map(m => ({ scheduleId, content: m.content, position: m.position })),
            });
        }

        const updated = await db.autoMessageSchedule.findUnique({
            where: { id: scheduleId },
            include: { messages: { orderBy: { position: 'asc' } } },
        });
        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// DELETE: remove a schedule
app.delete('/api/auto-messages/:guildId/:scheduleId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId, scheduleId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const existing = await db.autoMessageSchedule.findFirst({ where: { id: scheduleId, guildId } });
        if (!existing) return res.status(404).json({ error: 'Schedule not found' });
        await db.autoMessageSchedule.delete({ where: { id: scheduleId } });
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// --- Auto Responder Endpoints ---

// --- Category endpoints (must be registered before /:guildId/:ruleId routes) ---

// GET: list all categories for a guild
app.get('/api/auto-responder/:guildId/categories', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const cats = await db.autoResponderCategory.findMany({
            where: { guildId },
            orderBy: { createdAt: 'asc' },
        });
        res.json(cats);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// POST: create a new category
app.post('/api/auto-responder/:guildId/categories', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
        const cat = await db.autoResponderCategory.create({
            data: {
                guildId,
                name: (req.body.name || 'New Category').slice(0, 100),
            },
        });
        res.json(cat);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// PUT: update a category
app.put('/api/auto-responder/:guildId/categories/:categoryId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId, categoryId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const existing = await db.autoResponderCategory.findFirst({ where: { id: categoryId, guildId } });
        if (!existing) return res.status(404).json({ error: 'Category not found' });
        const { name, allowedChannels, ignoredChannels, cooldownSeconds, cooldownReactionEmoji } = req.body;
        const updated = await db.autoResponderCategory.update({
            where: { id: categoryId },
            data: {
                name: name !== undefined ? String(name).slice(0, 100) : undefined,
                allowedChannels: allowedChannels !== undefined ? (allowedChannels ? JSON.stringify(allowedChannels) : null) : undefined,
                ignoredChannels: ignoredChannels !== undefined ? (ignoredChannels ? JSON.stringify(ignoredChannels) : null) : undefined,
                cooldownSeconds: cooldownSeconds !== undefined ? Math.max(0, Math.min(86400, parseInt(cooldownSeconds) || 0)) : undefined,
                cooldownReactionEmoji: cooldownReactionEmoji !== undefined ? (cooldownReactionEmoji ? String(cooldownReactionEmoji).slice(0, 100) : null) : undefined,
            },
        });
        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// DELETE: remove a category (rules in the category will have categoryId set to null)
app.delete('/api/auto-responder/:guildId/categories/:categoryId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId, categoryId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const existing = await db.autoResponderCategory.findFirst({ where: { id: categoryId, guildId } });
        if (!existing) return res.status(404).json({ error: 'Category not found' });
        await db.autoResponderCategory.delete({ where: { id: categoryId } });
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// --- Rule endpoints ----------------------------------------------------------

// GET: list all rules for a guild
app.get('/api/auto-responder/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const rules = await db.autoResponderRule.findMany({
            where: { guildId },
            orderBy: { createdAt: 'asc' },
        });
        res.json(rules);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// POST: create a new rule
app.post('/api/auto-responder/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
        const rule = await db.autoResponderRule.create({
            data: {
                guildId,
                name: (req.body.name || 'New Rule').slice(0, 100),
                trigger: '',
                response: '',
            },
        });
        res.json(rule);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// PUT: update a rule
app.put('/api/auto-responder/:guildId/:ruleId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId, ruleId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const existing = await db.autoResponderRule.findFirst({ where: { id: ruleId, guildId } });
        if (!existing) return res.status(404).json({ error: 'Rule not found' });

        const { name, trigger, triggerType, response, enabled, allowedChannels, ignoredChannels, cooldownSeconds, cooldownReactionEmoji, embedJson, mentionUser, reactionEmoji, categoryId } = req.body;

        // Validate trigger type
        const validTypes = ['regex', 'exact', 'startsWith', 'contains', 'wholeWord'];
        const type = validTypes.includes(triggerType) ? triggerType : existing.triggerType;

        // Validate regex if regex type (strip unsupported inline flags like (?i) � JS applies 'i' flag natively)
        if (type === 'regex' && trigger) {
            const sanitizedTrigger = String(trigger).replace(/^\(\?[imsxUu-]+\)/g, '');
            try { new RegExp(sanitizedTrigger); } catch { return res.status(400).json({ error: 'Invalid regex pattern' }); }
        }

        // Validate categoryId if provided � must belong to the same guild
        if (categoryId !== undefined && categoryId !== null) {
            const cat = await db.autoResponderCategory.findFirst({ where: { id: categoryId, guildId } });
            if (!cat) return res.status(400).json({ error: 'Category not found in this guild' });
        }

        const updated = await db.autoResponderRule.update({
            where: { id: ruleId },
            data: {
                name: name !== undefined ? String(name).slice(0, 100) : undefined,
                trigger: trigger !== undefined ? String(trigger).slice(0, 500) : undefined,
                triggerType: type,
                response: response !== undefined ? String(response).slice(0, 2000) : undefined,
                enabled: enabled !== undefined ? !!enabled : undefined,
                allowedChannels: allowedChannels !== undefined ? (allowedChannels ? JSON.stringify(allowedChannels) : null) : undefined,
                ignoredChannels: ignoredChannels !== undefined ? (ignoredChannels ? JSON.stringify(ignoredChannels) : null) : undefined,
                cooldownSeconds: cooldownSeconds !== undefined ? Math.max(0, Math.min(86400, parseInt(cooldownSeconds) || 0)) : undefined,
                cooldownReactionEmoji: cooldownReactionEmoji !== undefined ? (cooldownReactionEmoji ? String(cooldownReactionEmoji).slice(0, 100) : null) : undefined,
                embedJson: embedJson !== undefined ? (embedJson ? JSON.stringify(embedJson) : null) : undefined,
                mentionUser: mentionUser !== undefined ? !!mentionUser : undefined,
                reactionEmoji: reactionEmoji !== undefined ? (reactionEmoji ? String(reactionEmoji).slice(0, 100) : null) : undefined,
                categoryId: categoryId !== undefined ? (categoryId || null) : undefined,
            },
        });
        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// DELETE: remove a rule
app.delete('/api/auto-responder/:guildId/:ruleId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId, ruleId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const existing = await db.autoResponderRule.findFirst({ where: { id: ruleId, guildId } });
        if (!existing) return res.status(404).json({ error: 'Rule not found' });
        await db.autoResponderRule.delete({ where: { id: ruleId } });
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// GET: guild-level auto-responder settings
app.get('/api/auto-responder/settings/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        let settings = await db.autoResponderSettings.findUnique({ where: { guildId } });
        if (!settings) settings = await db.autoResponderSettings.create({ data: { guildId } });
        res.json(settings);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// PUT: update guild-level auto-responder settings
app.put('/api/auto-responder/settings/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { globalCooldownSeconds } = req.body;
        const settings = await db.autoResponderSettings.upsert({
            where: { guildId },
            create: {
                guildId,
                globalCooldownSeconds: Math.max(0, Math.min(86400, parseInt(globalCooldownSeconds) || 0)),
            },
            update: {
                globalCooldownSeconds: globalCooldownSeconds !== undefined ? Math.max(0, Math.min(86400, parseInt(globalCooldownSeconds) || 0)) : undefined,
            },
        });
        res.json(settings);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// --- Pause Command Endpoints ---

app.get('/api/pause/settings/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        let settings = await db.pauseSettings.findUnique({ where: { guildId } });
        if (!settings) settings = await db.pauseSettings.create({ data: { guildId } });
        res.json(settings);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

app.put('/api/pause/settings/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { allowedRoleIds } = req.body;
        const settings = await db.pauseSettings.upsert({
            where: { guildId },
            create: { guildId, allowedRoleIds: Array.isArray(allowedRoleIds) ? allowedRoleIds : [] },
            update: { allowedRoleIds: Array.isArray(allowedRoleIds) ? allowedRoleIds : [] },
        });
        res.json(settings);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// --- Pause Command Endpoints ---

app.get('/api/pause/settings/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        let settings = await db.pauseSettings.findUnique({ where: { guildId } });
        if (!settings) settings = await db.pauseSettings.create({ data: { guildId } });
        res.json(settings);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

app.put('/api/pause/settings/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { allowedRoleIds } = req.body;
        const settings = await db.pauseSettings.upsert({
            where: { guildId },
            create: { guildId, allowedRoleIds: Array.isArray(allowedRoleIds) ? allowedRoleIds : [] },
            update: { allowedRoleIds: Array.isArray(allowedRoleIds) ? allowedRoleIds : [] },
        });
        res.json(settings);
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
});

// --- Ticket System Endpoints ---

// --- Voice Stat Channels API -------------------------------------------------
// GET settings
app.get('/api/voice-stats/settings/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        let settings = await db.voiceStatSettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await db.voiceStatSettings.create({ data: { guildId } });
        }
        // Also return current live counts for the UI preview
        const [artistCount, trackCount] = await Promise.all([
            db.musicianProfile.count({ where: { status: 'active', deletedAt: null } }),
            db.track.count({ where: { status: 'active', isPublic: true, deletedAt: null } }),
        ]);
        res.json({ ...settings, liveArtistCount: artistCount, liveTrackCount: trackCount });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get voice stat settings', detail: err?.message });
    }
});

// POST save settings
app.post('/api/voice-stats/settings/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const allowed = [
            'memberChannelId', 'memberChannelEnabled', 'memberLabel',
            'boostChannelId', 'boostChannelEnabled', 'boostLabel',
            'artistChannelId', 'artistChannelEnabled', 'artistLabel',
            'trackChannelId', 'trackChannelEnabled', 'trackLabel',
        ];
        const data: Record<string, any> = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) data[key] = req.body[key];
        }
        await db.guild.upsert({ where: { id: guildId }, create: { id: guildId, name: 'Unknown' }, update: {} });
        const settings = await db.voiceStatSettings.upsert({
            where: { guildId },
            create: { guildId, ...data },
            update: data,
        });
        res.json(settings);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to save voice stat settings', detail: err?.message });
    }
});

// POST trigger immediate stat refresh
app.post('/api/voice-stats/refresh/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        // The API and bot run in separate PM2 processes, so process.emit() won't cross the boundary.
        // Instead, we set a pendingRefresh flag in the DB. The bot polls every 30s and picks it up.
        await db.voiceStatSettings.upsert({
            where: { guildId },
            create: { guildId, pendingRefresh: true },
            update: { pendingRefresh: true },
        });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to trigger refresh', detail: err?.message });
    }
});
// -----------------------------------------------------------------------------

// Get Ticket Settings
app.get('/api/tickets/settings/:guildId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;

    if (!await checkPluginAccess(guildId, req, 'ticket')) {
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
    if (!hasDashboardAccess(guildId, req)) {
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

    if (!await checkPluginAccess(guildId, req, 'ticket')) {
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

    // Verify the ticket exists and user is admin in its guild
    const existingTicket = await db.ticket.findUnique({ where: { id: ticketId } });
    if (!existingTicket) return res.status(404).json({ error: 'Ticket not found' });
    if (!isTrueAdmin(existingTicket.guildId, req)) return res.status(403).json({ error: 'Forbidden' });

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

    // Verify user has ticket plugin access
    if (!await checkPluginAccess(ticket.guildId, req, 'ticket')) return res.status(403).json({ error: 'Forbidden' });

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

    if (!await checkPluginAccess(ticket.guildId, req, 'ticket')) return res.status(403).json({ error: 'Forbidden' });

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
        const { name, reason, targetChannelId, type, config, action, exemptRoles, requiredRoles, enabled } = req.body;
        
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
                reason: reason || null,
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/guilds/:guildId/channel-rules/:ruleId', async (req, res) => {
    try {
        const { guildId, ruleId } = req.params;
        const data = req.body; // Partial update?
        
        if (!await checkPluginAccess(guildId, req, 'channel-rules') && !isTrueAdmin(guildId, req)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Verify rule belongs to the authorized guild
        const existing = await db.channelRule.findUnique({ where: { id: ruleId } });
        if (!existing || existing.guildId !== guildId) return res.status(403).json({ error: 'Forbidden' });

        const rule = await db.channelRule.update({
            where: { id: ruleId },
            data: {
                name: data.name,
                reason: data.reason || null,
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
        res.status(500).json({ error: 'Failed to update rule' });
    }
});

app.delete('/api/guilds/:guildId/channel-rules/:ruleId', async (req, res) => {
    try {
        const { guildId, ruleId } = req.params; // guildId for double check?
        
        if (!await checkPluginAccess(guildId, req, 'channel-rules') && !isTrueAdmin(guildId, req)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Verify rule belongs to the authorized guild
        const existingRule = await db.channelRule.findUnique({ where: { id: ruleId } });
        if (!existingRule || existingRule.guildId !== guildId) return res.status(403).json({ error: 'Forbidden' });

        await db.channelRule.delete({ where: { id: ruleId } });
        res.json({ success: true });
    } catch (e: any) {
        logger.error('Failed to delete rule', e);
        res.status(500).json({ error: 'Failed to delete rule' });
    }
});

app.get('/api/guilds/:guildId/pending-reviews', async (req, res) => {
    try {
         const { guildId } = req.params;
         if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
         if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
         
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
         res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/guilds/:guildId/pending-reviews/:id/approve', async (req, res) => {
    try {
        const { guildId, id } = req.params;
        if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
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
                executorId: req.session.user?.id || 'WEB_USER',
                targetId: review.userId,
                details: { reviewId: id }
            }
        });

        res.json({ success: true });

    } catch (e: any) {
        logger.error('Failed to approve review', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/guilds/:guildId/pending-reviews/:id/reject', async (req, res) => {
    try {
        const { guildId, id } = req.params;
        if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
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
                executorId: req.session.user?.id || 'WEB_USER',
                targetId: review?.userId || 'UNKNOWN',
                details: { reviewId: id }
            }
        });

        res.json({ success: true });
    } catch (e: any) {
        logger.error('Failed to reject review', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Musician Profile API ---

// Post new track (Now with file uploads and metadata)
// Free-tier track cap \u2014 increase limit or gate behind paid tier in getUserTrackLimit() when billing is added
const FREE_TIER_TRACK_LIMIT = 25;

app.post('/api/musician/tracks', uploadLimiter, upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'artwork', maxCount: 1 },
  { name: 'project', maxCount: 1 } // Optional .flp project file
]), async (req: any, res) => {
    try {
        // Disable socket timeout for this route \u2014 large file uploads + ZIP processing can take minutes
        req.socket.setTimeout(0);

        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const audioFile = files['audio']?.[0];
        const artworkFile = files['artwork']?.[0];
        const projectFile = files['project']?.[0];

        if (!audioFile) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        // --- Per-user track cap ---
        const uploaderProfile = await db.musicianProfile.findUnique({ where: { userId } });
        if (uploaderProfile) {
            const trackCount = await db.track.count({
                where: { profileId: uploaderProfile.id, status: { not: 'deleted' } },
            });
            const trackLimit = FREE_TIER_TRACK_LIMIT; // Hook: replace with getUserTrackLimit(userId) when paid tiers exist
            if (trackCount >= trackLimit) {
                return res.status(403).json({
                    error: `You've reached the ${trackLimit}-track limit for free accounts. Delete an existing track to upload a new one.`,
                    code: 'TRACK_LIMIT_REACHED',
                    limit: trackLimit,
                    current: trackCount,
                });
            }
        }

        // --- Duplicate upload detection (prevents double-submit caused by 504/slow response) ---
        const uploadTitle = sanitizeDisplayName((req.body.title || audioFile.originalname).trim());
        if (uploaderProfile) {
            const recentDupe = await db.track.findFirst({
                where: {
                    profileId: uploaderProfile.id,
                    title: uploadTitle,
                    createdAt: { gte: new Date(Date.now() - 90_000) }, // within last 90 seconds
                },
                select: { id: true, title: true, createdAt: true },
            });
            if (recentDupe) {
                logger.warn(`[Upload] Duplicate submission blocked for user ${userId}: "${uploadTitle}" (existing: ${recentDupe.id})`);
                return res.status(409).json({
                    error: 'A track with this title was just uploaded. Your previous upload may still be processing \u2014 please wait a moment before trying again.',
                    code: 'DUPLICATE_UPLOAD',
                    existingTrackId: recentDupe.id,
                });
            }
        }

        // Magic byte validation — read only the first 16 bytes (async, non-blocking)
        try {
            await FileValidator.validatePath(audioFile.path, 'audio');
            if (artworkFile) await FileValidator.validatePath(artworkFile.path, 'image');
            if (projectFile) await FileValidator.validatePath(projectFile.path, 'project');
        } catch (validationErr: any) {
            // Clean up uploaded files on validation failure
            try { fs.unlinkSync(audioFile.path); } catch {}
            if (artworkFile) try { fs.unlinkSync(artworkFile.path); } catch {}
            if (projectFile) try { fs.unlinkSync(projectFile.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }

        // Virus scan all uploaded files before processing
        await scanFileForViruses(audioFile.path, 'audio');
        if (artworkFile) await scanFileForViruses(artworkFile.path, 'artwork');
        if (projectFile) await scanFileForViruses(projectFile.path, 'project');

        // Parse project file (.flp) or process ZIP bundle if provided
        let arrangement: object | null = null;
        let projectFileUrl: string | null = null;
        let projectZipUrl: string | null = null;
        let projectFileSizeBytes: number | null = null;
        const ext = projectFile?.originalname.toLowerCase().split('.').pop() ?? '';
        const isZipUpload = ext === 'zip';
        const isAlsUpload = ext === 'als';

        if (projectFile && !isZipUpload && !isAlsUpload) {
            // Plain .flp \u2014 parse arrangement only (async read to avoid blocking event loop)
            try {
                const flpBuffer = await import('node:fs/promises').then(fsp => fsp.readFile(projectFile.path));
                arrangement = FLPParser.parse(flpBuffer);
                projectFileUrl = `/uploads/projects/${path.basename(projectFile.path)}`;
                const arr = arrangement as any;
                logger.info(`Parsed FLP arrangement: ${projectFile.originalname} \u2014 BPM: ${arr?.bpm}, tracks: ${arr?.tracks?.length}, clips: ${arr?.tracks?.reduce((n: number, t: any) => n + t.clips.length, 0)}`);
            } catch (e) {
                logger.warn(`Failed to parse FLP file: ${projectFile.originalname} - ${e}`);
                // Continue without arrangement \u2014 don't block the upload
            }
        } else if (projectFile && isAlsUpload) {
            // Ableton .als \u2014 decompress gzip + parse XML
            try {
                const alsBuffer = await import('node:fs/promises').then(fsp => fsp.readFile(projectFile.path));
                arrangement = AlsParser.parse(alsBuffer);
                projectFileUrl = `/uploads/projects/${path.basename(projectFile.path)}`;
                const arr = arrangement as any;
                logger.info(`Parsed ALS arrangement: ${projectFile.originalname} \u2014 BPM: ${arr?.bpm}, tracks: ${arr?.tracks?.length}, plugins: ${arr?.projectInfo?.plugins?.length}`);
            } catch (e) {
                logger.warn(`Failed to parse .als file: ${projectFile.originalname} - ${e}`);
                // Continue without arrangement \u2014 don't block the upload
            }
        } else if (projectFile && isZipUpload) {
            // .zip bundle \u2014 will be processed after track is created (we need trackId first)
            projectFileSizeBytes = projectFile.size;
            projectZipUrl = `/uploads/projects/${path.basename(projectFile.path)}`;
            if (!R2Storage.isConfigured()) {
                logger.info('R2 not configured \u2014 ZIP samples will be served from local storage');
            }
        }

        // 1. Initial metadata extraction
        let metadata = {
            title: sanitizeDisplayName(req.body.title || audioFile.originalname),
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
            if (!req.body.title && parsed.common.title) metadata.title = sanitizeDisplayName(parsed.common.title);
            // Auto-fill from ID3 if user didn't supply
            if (!metadata.artist && parsed.common.artist) metadata.artist = sanitizeDisplayName(parsed.common.artist);
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

        // 2. Save to database immediately with raw file URLs.
        //    Audio conversion, waveform extraction and R2 uploads all run AFTER the HTTP response
        //    (via setImmediate below) so the browser never waits long enough to hit a proxy timeout.
        const audioUrl = `/uploads/tracks/${path.basename(audioFile.path)}`;
        const coverUrl = artworkFile ? `/uploads/artwork/${path.basename(artworkFile.path)}` : req.body.coverUrl;

        // Create slug from title � fall back to cuid when Unicode title produces empty string
        const slug = safeTrackSlug(metadata.title);

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
            ...(req.body.license ? { license: req.body.license } : {}),
            ...(req.body.trackType ? { trackType: req.body.trackType } : {}),
            ...(arrangement ? { arrangement } : {}),
            ...(projectFileUrl ? { projectFileUrl } : {}),
            ...(projectZipUrl ? { projectZipUrl } : {}),
            ...(projectFileSizeBytes != null ? { projectFileSizeBytes } : {}),
        });

        // Log track upload
        await logAction('GLOBAL', 'track_uploaded', userId, track.id, { title: track.title });

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

        // Respond immediately \u2014 track is playable right away from local storage.
        // Audio encoding, artwork optimisation, waveform extraction and R2/CDN uploads
        // happen in the background so the browser never hits a proxy timeout.
        const fullTrack = await db.track.findUnique({
            where: { id: track.id },
            include: { genres: { include: { genre: true } } }
        });

        invalidateProfileCache(userId);
        res.json(fullTrack);

        // Queue a Discord track announcement for the bot to pick up (separate PM2 process).
        // Skip when this upload is part of a battle submission \u2014 the BeatBattle plugin
        // will announce it in the battles channel instead.
        const _annGuildId = process.env.GUILD_ID;
        const _suppressAnnounce = req.body?.battleId || req.body?.suppressAnnounce === 'true' || req.body?.suppressAnnounce === true;
        if (_annGuildId && uploaderProfile && !_suppressAnnounce) {
            const genreNames = (fullTrack?.genres ?? []).map((tg: any) => tg.genre?.name).filter(Boolean);
            db.trackAnnouncement.create({
                data: {
                    guildId: _annGuildId,
                    trackId: track.id,
                    trackTitle: track.title,
                    artistName: uploaderProfile.displayName || uploaderProfile.username,
                    profileUsername: uploaderProfile.username,
                    trackSlug: track.slug ?? null,
                    coverUrl: coverUrl ?? null,
                    genres: genreNames,
                },
            }).catch((err: any) => logger.warn(`[TrackAnnouncer] Failed to queue announcement: ${err.message}`));
        }

        // Background: encode audio → optimise artwork → extract waveform → push to R2.
        // This runs after res.json() so it never blocks the HTTP response.
        const _bgRawAudioPath = audioFile.path;
        const _bgRawArtworkPath = artworkFile?.path ?? null;
        const _bgTrackId = track.id;
        const _bgProjectPath = (projectFile && !isZipUpload) ? projectFile.path : null;
        const _bgProjectFileUrl = projectFileUrl;
        setImmediate(async () => {
            try {
                const bgUpdates: Record<string, any> = {};

                // Convert audio to OGG Opus (primary stream)
                const finalAudioPath = await MediaConverter.convertToOgg(_bgRawAudioPath);
                bgUpdates.url = `/uploads/tracks/${path.basename(finalAudioPath)}`;

                // Also generate MP3 fallback for iOS Safari (doesn't delete the OGG source)
                try {
                    const mp3AudioPath = await MediaConverter.convertToMp3(finalAudioPath);
                    bgUpdates.mp3Url = `/uploads/tracks/${path.basename(mp3AudioPath)}`;
                } catch (mp3Err: any) {
                    logger.warn(`[Upload BG] MP3 fallback conversion failed for ${_bgTrackId}: ${mp3Err.message}`);
                }

                // Optimise artwork to WebP
                let finalArtworkPath: string | null = null;
                if (_bgRawArtworkPath) {
                    finalArtworkPath = await MediaConverter.optimizeImage(_bgRawArtworkPath);
                    bgUpdates.coverUrl = `/uploads/artwork/${path.basename(finalArtworkPath)}`;
                }

                // Extract waveform peaks for the feed visualiser
                try {
                    bgUpdates.waveformPeaks = await WaveformExtractor.extractPeaks(finalAudioPath, 200);
                } catch (wErr: any) {
                    logger.warn(`[Upload BG] Waveform extraction failed for track ${_bgTrackId}: ${wErr.message}`);
                }

                // Upload converted files to R2 (or keep local if R2 is not configured)
                const r2Jobs: Promise<void>[] = [];
                const r2Updates: Record<string, string> = {};

                r2Jobs.push((async () => {
                    const key = `tracks/${_bgTrackId}/audio/${path.basename(finalAudioPath)}`;
                    const cdn = await uploadToR2OrLocal(finalAudioPath, key, 'audio/ogg', bgUpdates.url as string);
                    if (cdn !== bgUpdates.url) r2Updates.url = cdn;
                })());

                if (bgUpdates.mp3Url) {
                    const localMp3Url = bgUpdates.mp3Url as string;
                    const mp3LocalPath = path.join(process.cwd(), 'public', localMp3Url);
                    r2Jobs.push((async () => {
                        const key = `tracks/${_bgTrackId}/audio/${path.basename(mp3LocalPath)}`;
                        const cdn = await uploadToR2OrLocal(mp3LocalPath, key, 'audio/mpeg', localMp3Url);
                        if (cdn !== localMp3Url) r2Updates.mp3Url = cdn;
                    })());
                }

                if (finalArtworkPath) {
                    const localArtUrl = bgUpdates.coverUrl as string;
                    r2Jobs.push((async () => {
                        const key = `tracks/${_bgTrackId}/artwork/${path.basename(finalArtworkPath!)}`;
                        const cdn = await uploadToR2OrLocal(finalArtworkPath!, key, 'image/webp', localArtUrl);
                        if (cdn !== localArtUrl) r2Updates.coverUrl = cdn;
                    })());
                }

                if (_bgProjectPath && _bgProjectFileUrl) {
                    r2Jobs.push((async () => {
                        const key = `tracks/${_bgTrackId}/project/${path.basename(_bgProjectPath)}`;
                        const cdn = await uploadToR2OrLocal(_bgProjectPath, key, 'application/octet-stream', _bgProjectFileUrl);
                        if (cdn !== _bgProjectFileUrl) r2Updates.projectFileUrl = cdn;
                    })());
                }

                await Promise.all(r2Jobs);
                Object.assign(bgUpdates, r2Updates);

                await db.track.update({ where: { id: _bgTrackId }, data: bgUpdates });
                logger.info(`[Upload BG] Media processing complete for track ${_bgTrackId}`);
            } catch (bgErr: any) {
                logger.error(`[Upload BG] Media processing failed for track ${_bgTrackId}: ${bgErr.message}`);
            }
        });

        // ZIP bundle: process samples and upload to R2 after response is sent (avoid 504 on large uploads)
        if (projectFile && isZipUpload) {
            const _zipPath = projectFile.path;
            const _trackId = track.id;
            const _bpm = metadata.bpm;
            const _localZipUrl = projectZipUrl!;
            setImmediate(async () => {
                try {
                    const { arrangement: enrichedArr, sampleCount } = await ProjectZipProcessor.process(
                        _zipPath,
                        _trackId,
                        db,
                    );
                    if (_bpm) (enrichedArr as any).bpm = _bpm;
                    await db.track.update({
                        where: { id: _trackId },
                        data: { arrangement: enrichedArr },
                    });
                    logger.info(`ZIP processed in background: ${sampleCount} samples for track ${_trackId}`);
                } catch (zipErr: any) {
                    logger.warn(`Background ZIP processing failed for track ${_trackId}: ${zipErr.message}`);
                }
                // Upload ZIP to R2 after processing (ProjectZipProcessor needs the local file first)
                try {
                    const r2ZipKey = `tracks/${_trackId}/project/${path.basename(_zipPath)}`;
                    const cdnZipUrl = await uploadToR2OrLocal(_zipPath, r2ZipKey, 'application/zip', _localZipUrl);
                    if (cdnZipUrl !== _localZipUrl) {
                        await db.track.update({ where: { id: _trackId }, data: { projectZipUrl: cdnZipUrl } });
                    }
                } catch (r2Err: any) {
                    logger.warn(`Background ZIP R2 upload failed for track ${_trackId}: ${r2Err.message}`);
                }
            });
        }
    } catch (e: any) {
        // Handle multer file-size errors with a friendly message
        if (e.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File is too large. Maximum size is 500MB. For WAV files, consider exporting at 16-bit/44.1kHz.' });
        }
        logger.error('Failed to upload track', e);
        res.status(500).json({ error: 'Failed to upload track' });
    }
});

// Save track lyrics (plain text + optional time-synced cues)
app.put('/api/musician/tracks/:trackId/lyrics', async (req: any, res) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { trackId } = req.params;
        const { lyrics, lyricsSync } = req.body;

        // Ownership check (admins can also edit)
        const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
        if (!track) return res.status(404).json({ error: 'Track not found' });
        const isAdmin = !!(req.session?.mutualAdminGuilds as any)?.length;
        if (track.profile.userId !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Block edits from the track owner if submitted to a beat battle
        if (!isAdmin) {
            const battleEntryCount = await db.battleEntry.count({ where: { trackId } });
            if (battleEntryCount > 0) {
                return res.status(409).json({
                    error: 'This track is a Beat Battle submission and cannot be modified.',
                    code: 'TRACK_IN_BATTLE',
                });
            }
        }

        // Validate lyricsSync shape: must be array of { time: number, text: string } or null
        if (lyricsSync !== undefined && lyricsSync !== null) {
            if (!Array.isArray(lyricsSync)) {
                return res.status(400).json({ error: 'lyricsSync must be an array' });
            }
            for (const cue of lyricsSync) {
                if (typeof cue.time !== 'number' || typeof cue.text !== 'string') {
                    return res.status(400).json({ error: 'Each lyricsSync cue must have { time: number, text: string }' });
                }
            }
        }

        const updateData: Record<string, any> = {};
        if (lyrics !== undefined) updateData.lyrics = lyrics || null;
        if (lyricsSync !== undefined) updateData.lyricsSync = lyricsSync || null;

        const updated = await db.track.update({
            where: { id: trackId },
            data: updateData as any,
        }) as any;

        res.json({ lyrics: updated.lyrics, lyricsSync: updated.lyricsSync });
    } catch (e: any) {
        logger.error(`[Track] Lyrics update failed for ${req.params.trackId}`, e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reorder tracks on profile timeline
app.put('/api/musician/tracks/positions', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { trackIds } = req.body;
        if (!Array.isArray(trackIds) || trackIds.length === 0) {
            return res.status(400).json({ error: 'trackIds array required' });
        }
        // Verify all tracks belong to this user
        const profile = await db.musicianProfile.findUnique({ where: { userId } });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        const owned = await db.track.count({ where: { id: { in: trackIds }, profileId: profile.id } });
        if (owned !== trackIds.length) return res.status(403).json({ error: 'Forbidden' });
        await db.$transaction(
            trackIds.map((id: string, idx: number) => db.track.update({ where: { id }, data: { position: idx } }))
        );
        invalidateProfileCache(userId);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update track info
app.patch('/api/musician/tracks/:trackId', async (req: any, res) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { trackId } = req.params;
        const { title, description, isPublic, artist, album, year, bpm, key, genreIds, allowAudioDownload, allowProjectDownload, license, trackType, slug } = req.body;

        // Ownership check
        const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
        if (!track || track.profile.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Block edits if the track has been submitted to a beat battle
        const battleEntryCount = await db.battleEntry.count({ where: { trackId } });
        if (battleEntryCount > 0) {
            return res.status(409).json({
                error: 'This track is a Beat Battle submission and cannot be modified.',
                code: 'TRACK_IN_BATTLE',
            });
        }

        // If track is being made private, clear it as the featured track on the profile
        if (isPublic === false || isPublic === 'false') {
            await db.musicianProfile.updateMany({
                where: { featuredTrackId: trackId },
                data: { featuredTrackId: null }
            });
        }

        // Validate and normalise custom slug if provided
        let resolvedSlug: string | undefined;
        if (slug !== undefined) {
            const raw = String(slug).toLowerCase().trim();
            if (raw.length > 0) {
                if (!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$|^[a-z0-9]{1,3}$/.test(raw)) {
                    return res.status(400).json({ error: 'Slug must be 3–80 characters, lowercase letters, numbers, and hyphens only.' });
                }
                // Uniqueness check within this profile (exclude current track)
                const conflict = await db.track.findFirst({ where: { slug: raw, profileId: track.profileId, id: { not: trackId } } });
                if (conflict) return res.status(409).json({ error: 'That URL is already used by another track on your profile.' });
                resolvedSlug = raw;
            }
        }

        const updated = await db.track.update({
            where: { id: trackId },
            data: {
                ...(title !== undefined && { title: sanitizeDisplayName(title), slug: safeTrackSlug(title) }),
                ...(resolvedSlug !== undefined && { slug: resolvedSlug }),
                ...(description !== undefined && { description }),
                ...(isPublic !== undefined && { isPublic }),
                ...(artist !== undefined && { artist: sanitizeDisplayName(artist) }),
                ...(album !== undefined && { album }),
                ...(year !== undefined && { year: year ? parseInt(year) : null }),
                ...(bpm !== undefined && { bpm: bpm ? parseInt(bpm) : null }),
                ...(key !== undefined && { key: key || null }),
                ...(allowAudioDownload !== undefined && { allowAudioDownload: allowAudioDownload === 'true' || allowAudioDownload === true }),
                ...(allowProjectDownload !== undefined && { allowProjectDownload: allowProjectDownload === 'true' || allowProjectDownload === true }),
                ...(license !== undefined && { license }),
                ...(trackType !== undefined && { trackType }),
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
        await logAction('GLOBAL', 'track_edited', userId, trackId, { title: fullTrack?.title }).catch(() => {});
        invalidateProfileCache(userId);
        res.json(fullTrack);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
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

        // Block deletion if the track has been submitted to any beat battle.
        // Battle entries are part of the public competition record and must remain
        // intact for the integrity of past/ongoing battles.
        const battleEntryCount = await db.battleEntry.count({ where: { trackId } });
        if (battleEntryCount > 0) {
            return res.status(409).json({
                error: 'This track is submitted to a Beat Battle and cannot be deleted. Withdraw the entry from the battle first, or contact a moderator.',
                code: 'TRACK_IN_BATTLE',
            });
        }

        // Delete physical files (from R2 or local storage)
        await deleteFromStorage(track.url);
        await deleteFromStorage(track.coverUrl);
        await deleteFromStorage((track as any).projectFileUrl);
        await deleteFromStorage((track as any).projectZipUrl);

        // Clear featured-track pointer (FK is SET NULL via app, not DB)
        await db.musicianProfile.updateMany({
            where: { featuredTrackId: trackId },
            data: { featuredTrackId: null }
        });

        // The Track row has ON DELETE CASCADE on every dependent relation
        // (TrackPlay, TrackSample, TrackGenre, Comment, TrackFavourite,
        //  TrackRepost, PlaylistTrack, RadioQueue) and SET NULL on RadioHistory,
        // so a single delete wipes every visible trace from playlists, radio
        // queues, comments, likes, reposts, plays and the discovery charts.
        await db.track.delete({ where: { id: trackId } });
        await logAction('GLOBAL', 'track_deleted', userId, trackId, { title: track.title }).catch(() => {});
        invalidateProfileCache(userId);
        res.json({ success: true });
    } catch (e: any) {
        logger.error(`[Track] Delete failed for trackId=${req.params.trackId}`, e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Edit track with file re-uploads (audio, artwork, project)
app.put('/api/musician/tracks/:trackId', generalUploadLimiter, upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'artwork', maxCount: 1 },
    { name: 'project', maxCount: 1 }
]), async (req: any, res) => {
    try {
        // Disable socket timeout for this route \u2014 large file uploads + ZIP processing can take minutes
        req.socket.setTimeout(0);

        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { trackId } = req.params;

        // Ownership check
        const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
        if (!track || track.profile.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Block edits if the track has been submitted to a beat battle
        const battleEntryCount = await db.battleEntry.count({ where: { trackId } });
        if (battleEntryCount > 0) {
            return res.status(409).json({
                error: 'This track is a Beat Battle submission and cannot be modified.',
                code: 'TRACK_IN_BATTLE',
            });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const audioFile = files['audio']?.[0];
        const artworkFile = files['artwork']?.[0];
        const projectFile = files['project']?.[0];

        // Magic byte validation — read only the first 16 bytes (async, non-blocking)
        try {
            if (audioFile) await FileValidator.validatePath(audioFile.path, 'audio');
            if (artworkFile) await FileValidator.validatePath(artworkFile.path, 'image');
            if (projectFile) await FileValidator.validatePath(projectFile.path, 'project');
        } catch (validationErr: any) {
            if (audioFile) try { fs.unlinkSync(audioFile.path); } catch {}
            if (artworkFile) try { fs.unlinkSync(artworkFile.path); } catch {}
            if (projectFile) try { fs.unlinkSync(projectFile.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }

        // Virus scan any newly uploaded files before processing
        if (audioFile) await scanFileForViruses(audioFile.path, 'audio');
        if (artworkFile) await scanFileForViruses(artworkFile.path, 'artwork');
        if (projectFile) await scanFileForViruses(projectFile.path, 'project');

        const updateData: any = {};

        // Text field updates
        const { title, description, artist, album, year, bpm, key: musicKey, genreIds, allowAudioDownload, allowProjectDownload, license } = req.body;
        logger.info(`[PUT track ${trackId}] allowAudioDownload=${JSON.stringify(allowAudioDownload)} allowProjectDownload=${JSON.stringify(allowProjectDownload)}`);
        if (title !== undefined) {
            const cleanTitle = sanitizeDisplayName(title);
            updateData.title = cleanTitle;
            updateData.slug = safeTrackSlug(cleanTitle);
        }
        if (description !== undefined) updateData.description = description || null;
        if (artist !== undefined) updateData.artist = sanitizeDisplayName(artist) || null;
        if (album !== undefined) updateData.album = album || null;
        if (year !== undefined) updateData.year = year ? parseInt(year) : null;
        if (bpm !== undefined) updateData.bpm = bpm ? parseInt(bpm) : null;
        if (musicKey !== undefined) updateData.key = musicKey || null;
        if (allowAudioDownload !== undefined) updateData.allowAudioDownload = allowAudioDownload === 'true' || allowAudioDownload === true;
        if (allowProjectDownload !== undefined) updateData.allowProjectDownload = allowProjectDownload === 'true' || allowProjectDownload === true;
        if (license !== undefined) updateData.license = license;
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
            // Convert to OGG Opus (primary)
            const finalAudioPath = await MediaConverter.convertToOgg(audioFile.path);
            // Also generate MP3 fallback for iOS
            try {
                const mp3Path = await MediaConverter.convertToMp3(finalAudioPath);
                const r2Mp3Key = `tracks/${trackId}/audio/${path.basename(mp3Path)}`;
                if (track.mp3Url) await deleteFromStorage((track as any).mp3Url);
                updateData.mp3Url = await uploadToR2OrLocal(mp3Path, r2Mp3Key, 'audio/mpeg', `/uploads/tracks/${path.basename(mp3Path)}`);
            } catch (mp3Err: any) {
                logger.warn(`[Edit track] MP3 fallback conversion failed: ${mp3Err.message}`);
            }
            // Delete old OGG from R2 or local
            await deleteFromStorage(track.url);
            // Upload new OGG to R2 or store locally
            const r2AudioKey = `tracks/${trackId}/audio/${path.basename(finalAudioPath)}`;
            updateData.url = await uploadToR2OrLocal(finalAudioPath, r2AudioKey, 'audio/ogg', `/uploads/tracks/${path.basename(finalAudioPath)}`);
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

        // Project file replacement \u2014 re-parse FLP or re-process ZIP
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
                    logger.info(`Re-parsed FLP for track edit: ${track.title} \u2014 arrangement BPM set to ${finalBpm}`);
                } catch (e) {
                    logger.warn(`Failed to parse replaced FLP file: ${e}`);
                }
                // Upload FLP to R2 or store locally
                const r2ProjectKey = `tracks/${trackId}/project/${path.basename(projectFile.path)}`;
                updateData.projectFileUrl = await uploadToR2OrLocal(projectFile.path, r2ProjectKey, 'application/octet-stream', `/uploads/projects/${path.basename(projectFile.path)}`);
            } else {
                // ZIP bundle replacement \u2014 respond immediately then process in background (avoid 504)
                updateData.projectFileSizeBytes = projectFile.size;
                updateData.projectZipUrl = `/uploads/projects/${path.basename(projectFile.path)}`;
                updateData.arrangement = null; // Will be repopulated after background processing
                const _zipPath = projectFile.path;
                const _trackId = trackId;
                const _localZipUrl = updateData.projectZipUrl;
                const _finalBpm = (bpm ? parseInt(bpm) : null) || updateData.bpm || track.bpm;
                setImmediate(async () => {
                    try {
                        const { arrangement: enrichedArr, sampleCount } = await ProjectZipProcessor.process(
                            _zipPath,
                            _trackId,
                            db,
                        );
                        if (_finalBpm) (enrichedArr as any).bpm = _finalBpm;
                        logger.info(`ZIP re-processed in background: ${sampleCount} samples for track ${_trackId}`);
                        // Upload ZIP to R2 after processing (ProjectZipProcessor needs the local file first)
                        const r2ZipKey = `tracks/${_trackId}/project/${path.basename(_zipPath)}`;
                        const cdnZipUrl = await uploadToR2OrLocal(_zipPath, r2ZipKey, 'application/zip', _localZipUrl);
                        await db.track.update({
                            where: { id: _trackId },
                            data: {
                                arrangement: enrichedArr,
                                ...(cdnZipUrl !== _localZipUrl ? { projectZipUrl: cdnZipUrl } : {}),
                            },
                        });
                    } catch (zipErr: any) {
                        logger.warn(`Background ZIP re-processing failed for track ${_trackId}: ${zipErr.message}`);
                    }
                });
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
        await logAction('GLOBAL', 'track_edited', userId, trackId, { title: fullTrack?.title }).catch(() => {});
        invalidateProfileCache(userId);
        res.json(fullTrack);
    } catch (e: any) {
        logger.error('Failed to update track', e);
        res.status(500).json({ error: e?.message || 'Internal server error' });
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
        // Bypass soft-delete middleware so admin can edit soft-deleted tracks
        const track = await db.track.findFirst({ where: { id: trackId, OR: [{ deletedAt: null }, { deletedAt: { not: null } }] }, include: { profile: true } });
        if (!track) return res.status(404).json({ error: 'Track not found' });

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const audioFile = files['audio']?.[0];
        const artworkFile = files['artwork']?.[0];
        const projectFile = files['project']?.[0];

        // Magic byte validation — read only the first 16 bytes (async, non-blocking)
        try {
            if (audioFile) await FileValidator.validatePath(audioFile.path, 'audio');
            if (artworkFile) await FileValidator.validatePath(artworkFile.path, 'image');
            if (projectFile) await FileValidator.validatePath(projectFile.path, 'project');
        } catch (validationErr: any) {
            if (audioFile) try { fs.unlinkSync(audioFile.path); } catch {}
            if (artworkFile) try { fs.unlinkSync(artworkFile.path); } catch {}
            if (projectFile) try { fs.unlinkSync(projectFile.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }

        // Virus scan any newly uploaded files before processing
        if (audioFile) await scanFileForViruses(audioFile.path, 'audio');
        if (artworkFile) await scanFileForViruses(artworkFile.path, 'artwork');
        if (projectFile) await scanFileForViruses(projectFile.path, 'project');

        const updateData: any = {};

        const { title, description, artist, album, year, bpm, key: musicKey, genreIds } = req.body;
        if (title !== undefined) {
            const cleanTitle = sanitizeDisplayName(title);
            updateData.title = cleanTitle;
            updateData.slug = safeTrackSlug(cleanTitle);
        }
        if (description !== undefined) updateData.description = description || null;
        if (artist !== undefined) updateData.artist = sanitizeDisplayName(artist) || null;
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Delete any track (hard delete, same cleanup as owner delete)
app.delete('/api/admin/tracks/:trackId', requireAdmin, async (req: any, res) => {
    try {
        const adminId = req.session.user.id;
        const { trackId } = req.params;
        // Bypass soft-delete middleware so admin can find+delete soft-deleted tracks too
        const track = await db.track.findFirst({ where: { id: trackId, OR: [{ deletedAt: null }, { deletedAt: { not: null } }] }, include: { profile: true } });
        if (!track) return res.status(404).json({ error: 'Track not found' });

        await deleteFromStorage(track.url);
        await deleteFromStorage(track.coverUrl);
        await deleteFromStorage((track as any).projectFileUrl);
        await deleteFromStorage((track as any).projectZipUrl);

        await db.musicianProfile.updateMany({
            where: { featuredTrackId: trackId },
            data: { featuredTrackId: null }
        });
        await db.track.delete({ where: { id: trackId } });
        await logAction('GLOBAL', 'track_deleted', adminId, trackId, { title: track.title, adminDelete: true }).catch(() => {});
        logger.info(`Admin deleted track: ${track.title} (ID: ${trackId}) by admin ${adminId}`);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: List all tracks (for admin track management)
app.get('/api/admin/tracks', requireAdmin, async (req: any, res) => {
    try {
        const search = req.query.search as string || '';
        // Bypass soft-delete middleware so admins see all tracks including deleted
        const deletedAtBypass = { OR: [{ deletedAt: null }, { deletedAt: { not: null } }] } as any;
        const tracks = await db.track.findMany({
            where: search ? {
                AND: [
                    deletedAtBypass,
                    { OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { artist: { contains: search, mode: 'insensitive' } },
                        { profile: { username: { contains: search, mode: 'insensitive' } } },
                        { profile: { displayName: { contains: search, mode: 'insensitive' } } },
                    ] },
                ],
            } : deletedAtBypass,
            select: {
                id: true,
                title: true,
                slug: true,
                coverUrl: true,
                playCount: true,
                status: true,
                deletedAt: true,
                profile: {
                    select: { id: true, username: true, displayName: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json(tracks);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Leaderboard: Top Tracks
app.get('/api/musician/leaderboards/tracks', publicCache(120), async (req, res) => {
    try {
        const cached = getCachedResponse('leaderboards-tracks');
        if (cached) return res.json(cached);

        const topTracks = await audioService.getTrackLeaderboard(12);
        
        // Track permission backfill
        topTracks.forEach((t: any) => {
            if (t.allowAudioDownload === undefined) t.allowAudioDownload = true;
            if (t.allowProjectDownload === undefined) t.allowProjectDownload = true;
        });

        setCachedResponse('leaderboards-tracks', topTracks);
        res.json(topTracks);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Discovery: Filtered Tracks (Genre/Search/Sort)
app.get('/api/discovery/tracks', publicCache(120), async (req, res) => {
    try {
        const { genre, search, sort = 'newest', limit = 24 } = req.query;

        // Cache the default (no filter) request \u2014 this is hit on every page load
        const isDefaultQuery = !genre && !search && sort === 'newest' && Number(limit) === 24;
        if (isDefaultQuery) {
            const cached = getCachedResponse('discovery-tracks');
            if (cached) return res.json(cached);
        }
        
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
            select: {
                id: true, title: true, slug: true, url: true, coverUrl: true,
                playCount: true, duration: true, isPublic: true, status: true,
                allowAudioDownload: true, allowProjectDownload: true,
                artist: true, bpm: true, key: true, profileId: true, createdAt: true,
                genres: { include: { genre: true } },
                profile: {
                    select: {
                        id: true, userId: true, username: true, displayName: true,
                        avatar: true, totalPlays: true, status: true,
                        genres: { include: { genre: true } },
                    }
                }
            },
            take: Number(limit)
        });

        // Ensure new permission fields exist even if migration hasn't run fully or records are old
        // Filter out suspended/hidden tracks and profiles (application-level so it's safe before migration)
        const activeTracks = tracks
            .filter((t: any) => (!t.status || t.status === 'active') && (!t.profile?.status || t.profile.status === 'active'))
            .map((t: any) => {
                if (t.allowAudioDownload === undefined) t.allowAudioDownload = true;
                if (t.allowProjectDownload === undefined) t.allowProjectDownload = true;
                return redactTrackUrls(t);
            });

        if (isDefaultQuery) setCachedResponse('discovery-tracks', { tracks: activeTracks, genre: null });

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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Leaderboard: Top Artists
app.get('/api/musician/leaderboards/artists', publicCache(120), async (req, res) => {
    try {
        const cached = getCachedResponse('leaderboards-artists');
        if (cached) return res.json(cached);

        const topArtists = await audioService.getArtistLeaderboard(10);
        setCachedResponse('leaderboards-artists', topArtists);
        res.json(topArtists);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Audio/project URL redaction ───────────────────────────────────────────────
// Replaces direct CDN URLs with the server-side stream proxy for tracks that
// have downloads disabled, so the raw storage URL is never sent to the client.
function redactTrackUrls(track: any): any {
    if (!track || typeof track !== 'object') return track;
    const t = { ...track };
    if (!t.allowAudioDownload) {
        // Replace with proxy endpoint — player still works, CDN URL stays hidden
        t.url    = t.id ? `/api/tracks/${t.id}/stream` : null;
        t.mp3Url = null;
    }
    if (!t.allowProjectDownload) {
        t.projectFileUrl       = null;
        t.projectZipUrl        = null;
        t.projectFileSizeBytes = null;
    }
    return t;
}

// Rate limiter for the stream proxy — generous enough to support audio seeking
// (multiple range requests per play) but hard enough to throttle bulk ripping.
const streamLimiter = rateLimit({
    windowMs: 60_000,
    max: 120,
    keyGenerator: rlKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Stream rate limit exceeded. Please wait before playing more tracks.' },
});

// Allowed origins for the stream endpoint — requests must come from the site itself
// or a known CDN/development origin for non-downloadable tracks.
const STREAM_ALLOWED_ORIGINS = new Set([
    process.env.DASHBOARD_ORIGIN?.replace(/\/$/, '') || 'https://fujistud.io',
    'https://www.fujistud.io',
]);

// Proxy stream for tracks with allowAudioDownload = false.
// Supports Range requests (required for seek/scrub in audio players).
// Never redirects to the CDN URL — always pipes through the server.
// For download-disabled tracks, requires an active login session AND an
// Origin/Referer header from the same site — blocks raw curl/wget/API scraping.
app.get('/api/tracks/:trackId/stream', streamLimiter, async (req: any, res) => {
    try {
        const { trackId } = req.params;
        const track = await db.track.findUnique({
            where: { id: trackId },
            select: { url: true, mp3Url: true, isPublic: true, status: true, deletedAt: true, allowAudioDownload: true },
        });
        if (!track || !track.isPublic || track.status !== 'active' || track.deletedAt) {
            return res.status(404).send();
        }

        // allowAudioDownload = false means "no download button / no CDN URL exposed",
        // not "login required to listen". Streaming is always public for public tracks.

        const useMp3 = req.query.format === 'mp3' && track.mp3Url;
        const sourceUrl: string = useMp3 ? track.mp3Url! : track.url;
        const contentType = useMp3 ? 'audio/mpeg' : 'audio/ogg';

        const upstreamHeaders: Record<string, string> = {};
        if (req.headers.range) upstreamHeaders['Range'] = req.headers.range as string;

        const upstream = await axios.get(sourceUrl, {
            responseType: 'stream',
            headers: upstreamHeaders,
            validateStatus: s => s < 500,
        });

        const outHeaders: Record<string, string | number> = {
            'Content-Type': contentType,
            'Content-Disposition': 'inline',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
        };
        if (upstream.headers['content-length']) outHeaders['Content-Length'] = upstream.headers['content-length'] as string;
        if (upstream.headers['content-range'])  outHeaders['Content-Range']  = upstream.headers['content-range']  as string;

        res.writeHead(upstream.status, outHeaders);
        (upstream.data as NodeJS.ReadableStream).pipe(res);
    } catch (e: any) {
        if (!res.headersSent) res.status(500).send();
    }
});

// --- Download Routes (Auth-gated + Logged) ---

// Helper to log downloads
async function logDownload(req: any, fileType: string, trackId?: string, fileName?: string) {
    try {
        await db.downloadLog.create({
            data: {
                userId: req.session.user.id,
                username: req.session.user.username || req.session.user.global_name || null,
                trackId: trackId || null,
                fileType,
                fileName: fileName || null,
                ipAddress: req.ip || req.headers['x-forwarded-for'] as string || null,
                userAgent: req.headers['user-agent'] || null,
            }
        });
    } catch (e) {
        logger.error('[DownloadLog] Failed to log download', e);
    }
}

// Download audio file
app.get('/api/downloads/audio/:trackId', requireAuth, async (req: any, res) => {
    try {
        const { trackId } = req.params;
        const track = await db.track.findUnique({
            where: { id: trackId },
            select: { url: true, title: true, allowAudioDownload: true, isPublic: true }
        });
        if (!track) return res.status(404).json({ error: 'Track not found' });
        if (!track.allowAudioDownload) return res.status(403).json({ error: 'Audio downloads are disabled for this track' });

        const safeName = (track.title || 'audio').replace(/[^a-z0-9_\- ]/gi, '_');
        const ext = path.extname(track.url) || '.mp3';
        await logDownload(req, 'audio', trackId, `${safeName}${ext}`);

        if (track.url.startsWith('http')) {
            return res.redirect(302, track.url);
        }

        const localPath = path.join(PROJECT_ROOT, 'public', track.url);
        if (!fs.existsSync(localPath)) return res.status(404).json({ error: 'File not found on server' });
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}${ext}"`);
        fs.createReadStream(localPath).pipe(res);
    } catch (e: any) {
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
});

// Download project .flp file
app.get('/api/downloads/project/:trackId', requireAuth, async (req: any, res) => {
    try {
        const { trackId } = req.params;
        const track = await db.track.findUnique({
            where: { id: trackId },
            select: { projectFileUrl: true, title: true, allowProjectDownload: true, isPublic: true }
        });
        if (!track) return res.status(404).json({ error: 'Track not found' });
        if (!track.projectFileUrl) return res.status(404).json({ error: 'No project file available for this track' });
        if (!track.allowProjectDownload) return res.status(403).json({ error: 'Project downloads are disabled for this track' });

        const safeName = (track.title || 'project').replace(/[^a-z0-9_\- ]/gi, '_');
        await logDownload(req, 'project_flp', trackId, `${safeName}.flp`);

        if (track.projectFileUrl.startsWith('http')) {
            return res.redirect(302, track.projectFileUrl);
        }

        const localPath = path.join(PROJECT_ROOT, 'public', track.projectFileUrl);
        if (!fs.existsSync(localPath)) return res.status(404).json({ error: 'File not found on server' });
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.flp"`);
        fs.createReadStream(localPath).pipe(res);
    } catch (e: any) {
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
});

// Download ZIP loop package (proxied to handle CDN cross-origin)
app.get('/api/tracks/:trackId/download-zip', requireAuth, async (req: any, res) => {
    try {
        const { trackId } = req.params;
        const track = await db.track.findUnique({
            where: { id: trackId },
            select: { projectZipUrl: true, title: true, allowProjectDownload: true, isPublic: true }
        });
        if (!track) return res.status(404).json({ error: 'Track not found' });
        if (!track.projectZipUrl) return res.status(404).json({ error: 'No loop package available for this track' });
        if (!track.allowProjectDownload) return res.status(403).json({ error: 'Project downloads are disabled for this track' });

        const safeName = (track.title || 'loop_package').replace(/[^a-z0-9_\- ]/gi, '_');
        await logDownload(req, 'project_zip', trackId, `${safeName}_loop_package.zip`);

        if (track.projectZipUrl.startsWith('http')) {
            return res.redirect(302, track.projectZipUrl);
        }

        // Local fallback
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_loop_package.zip"`);
        res.setHeader('Content-Type', 'application/zip');
        const localPath = path.join(PROJECT_ROOT, 'public', track.projectZipUrl);
        if (!fs.existsSync(localPath)) return res.status(404).json({ error: 'File not found on server' });
        fs.createReadStream(localPath).pipe(res);
    } catch (e: any) {
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Discovery (List all profiles)
app.get('/api/musician/profiles', publicCache(120), async (req, res) => {
  try {
      const { search, genre, sort = 'newest', limit = 50 } = req.query;
      
      // Cache unfiltered default requests
      const isDefaultQuery = !search && !genre && sort === 'newest' && Number(limit) === 50;
      if (isDefaultQuery) {
          const cached = getCachedResponse('musician-profiles');
          if (cached) return res.json(cached);
      }
      
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
      if (sort === 'popular') orderBy = { totalPlays: 'desc' };
      if (sort === 'oldest') orderBy = { createdAt: 'asc' };

      const profiles = await db.musicianProfile.findMany({
          where,
          include: {
              genres: { include: { genre: true } },
              primaryGenre: true,
              tracks: { 
                  where: { isPublic: true, status: 'active', deletedAt: null },
                  take: 1,
                  orderBy: { playCount: 'desc' },
                  // Explicit select avoids loading large JSON columns (arrangement, waveformPeaks)
                  // on every profile card in the list \u2014 these can be MB each
                  select: {
                      id: true, title: true, slug: true, url: true, coverUrl: true,
                      playCount: true, duration: true, isPublic: true, status: true,
                      allowAudioDownload: true, allowProjectDownload: true,
                      bpm: true, key: true, profileId: true, createdAt: true,
                  }
              },
              _count: {
                  select: { tracks: { where: { deletedAt: null } } }
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
      let activeProfiles = profiles.filter((p: any) => !p.status || p.status === 'active');

      // Deduplicate by username — keep the profile with the most tracks when duplicates exist
      // (can occur after the duplicate-account bug where two MusicianProfile rows share a username)
      const seenUsernames = new Map<string, any>();
      for (const p of activeProfiles) {
          const key = (p.username || '').toLowerCase();
          const existing = seenUsernames.get(key);
          if (!existing || (p._count?.tracks ?? 0) > (existing._count?.tracks ?? 0)) {
              seenUsernames.set(key, p);
          }
      }
      activeProfiles = Array.from(seenUsernames.values());

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

      if (isDefaultQuery) setCachedResponse('musician-profiles', activeProfiles);
      res.json(activeProfiles);
  } catch (e: any) {
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Public Profile Retrieval
// No publicCache here — we use server-side apiResponseCache (invalidated on upload/edit/delete)
// so Cloudflare edge caching would only serve stale profiles after new track uploads.
app.get('/api/musician/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // When the requesting user is the profile owner, skip the server cache entirely
        // so their own track list is always fresh after an upload/edit/delete.
        const requestingUserId = (req as any).session?.user?.id;
        const isOwnerRequest = !!requestingUserId && requestingUserId.toLowerCase() === userId.toLowerCase();

        // Check per-profile cache first (5-minute TTL via 'profile' prefix key)
        const cacheKey = `profile-${userId.toLowerCase()}`;
        const cached = !isOwnerRequest && getCachedResponse(cacheKey);
        if (cached) return res.json(cached);

        // Single query via ProfileService (handles both userId and case-insensitive username)
        const profile = await profileService.getProfile(userId);

        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        const profileData = profile as any;
        if (profileData.status && profileData.status !== 'active') {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Filter out non-active tracks and back-fill permission defaults
        if (profileData.tracks) {
            profileData.tracks = profileData.tracks.filter((t: any) => t.status === 'active' || !t.status);
            // Sort by explicit position first, then by createdAt for tracks with equal positions
            profileData.tracks.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            profileData.tracks = profileData.tracks.map((t: any) => {
                if (t.allowAudioDownload === undefined) t.allowAudioDownload = true;
                if (t.allowProjectDownload === undefined) t.allowProjectDownload = true;
                // Downsample waveform to 60pts for the profile card view (full 200pts served on track detail page)
                if (Array.isArray(t.waveformPeaks)) t.waveformPeaks = downsamplePeaks(t.waveformPeaks, 60);
                return redactTrackUrls(t);
            });
        }

        // Fetch reposts in parallel-after-profile (userId is now known)
        const reposts = await db.trackRepost.findMany({
            where: { userId: profileData.userId, track: { deletedAt: null } },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                track: {
                    select: {
                        id: true, profileId: true, title: true, slug: true,
                        url: true, coverUrl: true, duration: true, playCount: true,
                        isPublic: true, status: true, bpm: true, key: true,
                        artist: true, createdAt: true, waveformPeaks: true,
                        profile: { select: { userId: true, username: true, displayName: true, avatar: true } },
                        genres: { include: { genre: true } },
                        _count: { select: { favourites: true, reposts: true, comments: true } },
                    },
                },
            },
        });
        profileData.reposts = reposts
            .filter(r => r.track && r.track.isPublic && (!r.track.status || r.track.status === 'active'))
            .map(r => redactTrackUrls({
                ...r.track,
                waveformPeaks: Array.isArray(r.track.waveformPeaks) ? downsamplePeaks(r.track.waveformPeaks as number[], 60) : r.track.waveformPeaks,
                _repost: true,
                _repostedAt: r.createdAt,
                _originalArtist: r.track.profile,
            }));

        // Fetch accepted collab tracks (tracks where this profile is a confirmed collaborator)
        const collabEntries = await db.trackCollaborator.findMany({
            where: { profileId: profileData.id, status: 'accepted' },
            include: {
                track: {
                    select: {
                        id: true, profileId: true, title: true, slug: true,
                        url: true, coverUrl: true, duration: true, playCount: true,
                        isPublic: true, status: true, bpm: true, key: true,
                        artist: true, createdAt: true, waveformPeaks: true,
                        profile: { select: { userId: true, username: true, displayName: true, avatar: true } },
                        genres: { include: { genre: true } },
                        _count: { select: { favourites: true, reposts: true, comments: true } },
                    },
                },
            },
        });
        profileData.collaborations = collabEntries
            .filter(c => c.track && c.track.isPublic && (!c.track.status || c.track.status === 'active'))
            .map(c => redactTrackUrls({
                ...c.track,
                waveformPeaks: Array.isArray(c.track.waveformPeaks) ? downsamplePeaks(c.track.waveformPeaks as number[], 60) : c.track.waveformPeaks,
                _collab: true,
                _collabContribution: c.contribution,
                _collabCategory: c.category,
                _originalArtist: c.track.profile,
            }));

        // Fetch public playlists for this profile — releases first, then by profilePosition
        const profilePlaylists = await db.playlist.findMany({
            where: { userId: profileData.userId, isPublic: true, deletedAt: null },
            orderBy: [{ profilePosition: 'asc' }],
            include: {
                tracks: {
                    where: { track: { deletedAt: null } },
                    orderBy: { position: 'asc' },
                    take: 4,
                    include: { track: { select: { id: true, coverUrl: true, title: true } } },
                },
            },
        });
        // Releases (have a releaseType) bubble to the top within same profilePosition tier
        profileData.playlists = [
            ...profilePlaylists.filter(p => p.releaseType),
            ...profilePlaylists.filter(p => !p.releaseType),
        ];

        // Only cache for non-owner requests — owner always gets a live query (see above)
        if (!isOwnerRequest) setCachedResponse(cacheKey, profileData);
        res.json(profileData);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/musician/tracks/:username/:trackSlug', publicCache(15), async (req, res) => {
    try {
        const { username, trackSlug } = req.params;

        // Look up by slug + profile username in one query.
        // This avoids the two-step profile-then-track pattern which fails when multiple
        // MusicianProfile rows share the same username (duplicate-account edge case):
        // findFirst on username alone may return the wrong profile, missing the track.
        const includeShape = {
            profile: true,
            genres: { include: { genre: true } },
            plays: true,
            samples: true,
            collaborators: {
                where: { status: 'accepted' },
                include: { profile: { select: { id: true, userId: true, username: true, displayName: true, avatar: true } } },
                orderBy: { invitedAt: 'asc' as const },
            },
        };
        let track = (await db.track.findFirst({
            where: {
                slug: { equals: trackSlug, mode: 'insensitive' },
                profile: { username: { equals: username, mode: 'insensitive' } },
            },
            include: includeShape,
        })) as any;

        // Fallback: treat trackSlug as a track ID (for old links that used ID instead of slug)
        if (!track) {
            track = (await db.track.findFirst({
                where: {
                    id: trackSlug,
                    profile: { username: { equals: username, mode: 'insensitive' } },
                },
                include: includeShape,
            })) as any;
        }

        if (!track) {
            // Verify whether the artist exists at all for a better error message
            const artistExists = await db.musicianProfile.findFirst({
                where: { username: { equals: username, mode: 'insensitive' } }
            });
            return res.status(404).json({ error: artistExists ? 'Track not found' : 'Artist not found' });
        }

        if (track.allowAudioDownload === undefined) track.allowAudioDownload = true;
        if (track.allowProjectDownload === undefined) track.allowProjectDownload = true;

        // Attach battle memberships (badge + leaderboard placement on track page)
        try {
            const battleEntries = await db.battleEntry.findMany({
                where: { trackId: track.id, deletedAt: null },
                select: {
                    id: true, voteCount: true,
                    battle: { select: { id: true, title: true, slug: true, status: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
            track.battles = battleEntries.map((e: any) => ({
                entryId: e.id,
                voteCount: e.voteCount,
                battleId: e.battle.id,
                battleTitle: e.battle.title,
                battleSlug: e.battle.slug,
                battleStatus: e.battle.status,
            }));
        } catch { track.battles = []; }

        res.json(redactTrackUrls(track));
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// -- Social link domain validation ---------------------------------------------
const SOCIAL_DOMAIN_RULES: Record<string, { pattern: RegExp; label: string }> = {
    spotify:    { pattern: /^https?:\/\/(open\.)?spotify\.com\//i,    label: 'Spotify (open.spotify.com)' },
    soundcloud: { pattern: /^https?:\/\/(www\.)?soundcloud\.com\//i,  label: 'SoundCloud (soundcloud.com)' },
    youtube:    { pattern: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i, label: 'YouTube (youtube.com or youtu.be)' },
    instagram:  { pattern: /^https?:\/\/(www\.)?instagram\.com\//i,   label: 'Instagram (instagram.com)' },
};

function validateSocialUrls(data: any): string | null {
    const fields: Record<string, string> = {
        spotifyUrl:    'spotify',
        soundcloudUrl: 'soundcloud',
        youtubeUrl:    'youtube',
        instagramUrl:  'instagram',
    };
    for (const [field, platform] of Object.entries(fields)) {
        const url: string | undefined = data[field];
        if (!url || url.trim() === '') continue;
        const rule = SOCIAL_DOMAIN_RULES[platform];
        if (!rule.pattern.test(url.trim())) {
            return `Invalid URL for ${platform}. Must be a valid ${rule.label} link.`;
        }
    }
    // Discord is a username/handle, not a URL � just validate length
    if (data.discordUrl && data.discordUrl.trim().length > 100) {
        return 'Discord username must be 100 characters or fewer.';
    }
    return null;
}

// Update Profile
app.post('/api/musician/profile/:userId', async (req: any, res) => {
    try {
        const { userId } = req.params;

        // SEC-01: Ownership check \u2014 only profile owner or admin can edit
        if (req.session?.user?.id !== userId && !(req.session?.mutualAdminGuilds as any)?.length) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Normalize to the internal DB user ID. When a Discord account is linked to an email
        // account, session.user.id becomes the Discord ID (numeric string) while _localId holds
        // the real cuid. Using the Discord ID for the upsert would create a second MusicianProfile
        // alongside the original email-signup profile, causing the duplicate-profile bug.
        const canonicalUserId = req.session?.user?._localId || userId;

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

        // Ensure username is present (Required by schema).
        // Fallback chain: provided value → displayName slug → session username → userId suffix.
        // 'Unknown Musician' was removed — it would collide on the unique index for non-Discord users.
        const user = await resolveUser(userId);
        if (!data.username) {
            const fallbackRaw = user?.username
                || (data.displayName as string | undefined)
                || (req as any).session?.user?.username
                || `producer-${canonicalUserId.slice(-6)}`;
            data.username = fallbackRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `producer-${canonicalUserId.slice(-6)}`;
        }

        // Auto-update avatar from Discord ONLY if no custom avatar is provided
        if (user && user.avatar && !data.avatar) {
            data.avatar = user.avatar;
        }

        // Validate social link domains
        const socialUrlError = validateSocialUrls(data);
        if (socialUrlError) return res.status(400).json({ error: socialUrlError });

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

        const updated = await profileService.updateProfile(canonicalUserId, {
            ...data,
            socials,
            genreIds,
            featuredTrackId: data.featuredTrackId,
            featuredPlaylistId: data.featuredPlaylistId
        });

        // Log profile creation/update
        await logAction('GLOBAL', 'profile_updated', canonicalUserId, updated.id, { username: updated.username });

        // Invalidate profile cache for this user
        apiResponseCache.delete(`profile-${canonicalUserId.toLowerCase()}`);
        if (updated.username) apiResponseCache.delete(`profile-${updated.username.toLowerCase()}`);

        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Genre Library for Picker
app.get('/api/musician/genres', publicCache(300), async (req, res) => {
    try {
        const cached = getCachedResponse('genres');
        if (cached) return res.json(cached);

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
        
        setCachedResponse('genres', genres);
        res.json(genres);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Add/Update Genre
app.post('/api/musician/genres', requireAdmin, async (req, res) => {
    try {
        const { name, parentId } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const genre = await db.genre.upsert({
            where: { name },
            update: { parentId, slug },
            create: { name, parentId, slug }
        });
        apiResponseCache.delete('genres');
        res.json(genre);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Delete Genre
app.delete('/api/musician/genres/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await db.genre.delete({ where: { id } });
        apiResponseCache.delete('genres');
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== Discovery Settings (Admin) =====

// Get discovery settings
app.get('/api/discovery/settings', publicCache(120), async (req, res) => {
    try {
        // Check response cache first
        const cached = getCachedResponse('discovery-settings');
        if (cached) return res.json(cached);

        let settings = await db.discoverySettings.findUnique({ where: { id: 'singleton' } });
        if (!settings) {
            settings = await db.discoverySettings.create({ data: { id: 'singleton' } });
        }
        const result: any = { ...settings, featuredTrack: null, featuredArtist: null, featuredPlaylist: null };

        // Build parallel queries for all independent data
        const queries: Promise<void>[] = [];

        // Featured content (track/artist/playlist)
        if (settings.featuredType === 'track' && settings.featuredTrackId) {
            queries.push(db.track.findUnique({
                where: { id: settings.featuredTrackId },
                include: { profile: true, genres: { include: { genre: true } }, _count: { select: { favourites: true, comments: true } } }
            }).then((featuredTrack: any) => {
                if (featuredTrack) {
                    if (featuredTrack.allowAudioDownload === undefined) featuredTrack.allowAudioDownload = true;
                    if (featuredTrack.allowProjectDownload === undefined) featuredTrack.allowProjectDownload = true;
                }
                result.featuredTrack = featuredTrack;
            }));
        } else if (settings.featuredType === 'artist' && settings.featuredArtistId) {
            queries.push(db.musicianProfile.findUnique({
                where: { userId: settings.featuredArtistId },
                include: { tracks: { where: { isPublic: true, deletedAt: null }, orderBy: { playCount: 'desc' }, take: 5, include: { genres: { include: { genre: true } } } }, genres: { include: { genre: true } } },
            }).then(featuredArtist => { result.featuredArtist = featuredArtist; }));
        } else if (settings.featuredType === 'playlist' && settings.featuredPlaylistId) {
            queries.push(db.playlist.findUnique({
                where: { id: settings.featuredPlaylistId },
                include: {
                    tracks: { where: { track: { deletedAt: null } }, orderBy: { position: 'asc' }, take: 10, include: { track: { include: { profile: { select: { username: true, displayName: true, avatar: true, userId: true } } } } } },
                    profile: { select: { username: true, displayName: true, avatar: true, userId: true } },
                    _count: { select: { tracks: true } },
                },
            }).then(featuredPlaylist => { result.featuredPlaylist = featuredPlaylist; }));
        }

        // Editor's picks
        const editorPickIds = (settings.editorPickTrackIds as string[] | null) || [];
        if (editorPickIds.length > 0) {
            queries.push(db.track.findMany({
                where: { id: { in: editorPickIds }, isPublic: true },
                include: { profile: { select: { username: true, displayName: true, avatar: true, userId: true } } },
            }).then(editorPicks => { result.editorPicks = editorPicks; }));
        } else {
            result.editorPicks = [];
        }

        // Featured producer
        if (settings.featuredProducerId) {
            queries.push(db.musicianProfile.findUnique({
                where: { userId: settings.featuredProducerId },
                include: {
                    tracks: { where: { isPublic: true, deletedAt: null }, orderBy: { playCount: 'desc' }, take: 1 },
                    genres: { include: { genre: true } },
                },
            }).then(featuredProducer => {
                result.featuredProducer = featuredProducer;
                result.featuredProducerNote = settings!.featuredProducerNote;
            }));
        } else {
            result.featuredProducer = null;
        }

        // Featured battle
        if ((settings as any).featuredBattleId) {
            queries.push(db.beatBattle.findUnique({
                where: { id: (settings as any).featuredBattleId },
                include: {
                    sponsor: true,
                    _count: { select: { entries: { where: { deletedAt: null } } } },
                },
            }).then(featuredBattle => {
                result.featuredBattle = featuredBattle;
                result.featuredBattleDescription = (settings as any).featuredBattleDescription;
            }));
        } else {
            result.featuredBattle = null;
        }

        // Run all queries in parallel
        await Promise.all(queries);

        // Featured tutorial (no DB query needed)
        result.featuredContentType = (settings as any).featuredContentType || 'video';
        result.featuredTutorialUrl = settings.featuredTutorialUrl;
        result.featuredTutorialTitle = settings.featuredTutorialTitle;
        result.featuredTutorialDescription = (settings as any).featuredTutorialDescription;
        result.featuredTutorialThumbnail = settings.featuredTutorialThumbnail;
        result.featuredTutorialAuthor = (settings as any).featuredTutorialAuthor;
        result.featuredTutorialDate = (settings as any).featuredTutorialDate;

        // Global brand partners (front page + battles page)
        const globalSponsorIds = ((settings as any).globalSponsorIds as string[] | null) || [];
        if (globalSponsorIds.length > 0) {
            queries.push(db.battleSponsor.findMany({
                where: { id: { in: globalSponsorIds } },
                include: { links: true },
            }).then(sponsors => {
                const map = new Map(sponsors.map((s: any) => [s.id, s]));
                result.globalSponsors = globalSponsorIds.map((id: string) => map.get(id)).filter(Boolean);
                result.globalSponsorTitle = (settings as any).globalSponsorTitle || 'Our Partners';
            }));
        } else {
            result.globalSponsors = [];
            result.globalSponsorTitle = (settings as any).globalSponsorTitle || 'Our Partners';
        }

        // Trending artist override (admin-set, invisible to public)
        const trendingOverrideId = (settings as any).trendingArtistOverrideId;
        if (trendingOverrideId) {
            queries.push(db.musicianProfile.findUnique({
                where: { userId: trendingOverrideId },
                include: { genres: { include: { genre: true } } },
            }).then(profile => { result.trendingArtistOverride = profile || null; }));
        } else {
            result.trendingArtistOverride = null;
        }

        // Featured article (for 'article' content type)
        const featuredArticleId = (settings as any).featuredArticleId;
        if (featuredArticleId) {
            const featArticle = await db.article.findUnique({
                where: { id: featuredArticleId },
                select: {
                    id: true, slug: true, title: true, subtitle: true, excerpt: true,
                    coverImageUrl: true, authorName: true, authorAvatar: true,
                    category: true, publishedAt: true, viewCount: true, status: true,
                },
            });
            result.featuredArticle = (featArticle?.status === 'published') ? featArticle : null;
        } else {
            result.featuredArticle = null;
        }
        result.featuredArticleId = featuredArticleId || null;

        setCachedResponse('discovery-settings', result);
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update discovery settings (admin only)
app.post('/api/discovery/settings', requireAdmin, async (req, res) => {
    try {
        const {
            featuredType, featuredTrackId, featuredArtistId, featuredPlaylistId, featuredLabel,
            featuredDescription,
            editorPickTrackIds, featuredProducerId, featuredProducerNote,
            featuredContentType,
            featuredTutorialUrl, featuredTutorialTitle, featuredTutorialDescription, featuredTutorialThumbnail,
            featuredTutorialAuthor, featuredTutorialDate,
            featuredBattleId, featuredBattleDescription,
            featuredArticleId,
            trendingArtistOverrideId,
            globalSponsorIds,
            globalSponsorTitle,
        } = req.body;

        const updateData: any = {};
        if (featuredType !== undefined) updateData.featuredType = featuredType;
        if (featuredTrackId !== undefined) updateData.featuredTrackId = featuredTrackId;
        if (featuredArtistId !== undefined) updateData.featuredArtistId = featuredArtistId;
        if (featuredPlaylistId !== undefined) updateData.featuredPlaylistId = featuredPlaylistId;
        if (featuredLabel !== undefined) updateData.featuredLabel = featuredLabel;
        if (featuredDescription !== undefined) updateData.featuredDescription = featuredDescription;
        if (editorPickTrackIds !== undefined) updateData.editorPickTrackIds = editorPickTrackIds;
        if (featuredProducerId !== undefined) updateData.featuredProducerId = featuredProducerId;
        if (featuredProducerNote !== undefined) updateData.featuredProducerNote = featuredProducerNote;
        if (featuredContentType !== undefined) updateData.featuredContentType = featuredContentType;
        if (featuredTutorialUrl !== undefined) updateData.featuredTutorialUrl = featuredTutorialUrl;
        if (featuredTutorialTitle !== undefined) updateData.featuredTutorialTitle = featuredTutorialTitle;
        if (featuredTutorialDescription !== undefined) updateData.featuredTutorialDescription = featuredTutorialDescription;
        if (featuredTutorialThumbnail !== undefined) updateData.featuredTutorialThumbnail = featuredTutorialThumbnail;
        if (featuredTutorialAuthor !== undefined) updateData.featuredTutorialAuthor = featuredTutorialAuthor;
        if (featuredTutorialDate !== undefined) updateData.featuredTutorialDate = featuredTutorialDate;
        if (featuredBattleId !== undefined) updateData.featuredBattleId = featuredBattleId;
        if (featuredBattleDescription !== undefined) updateData.featuredBattleDescription = featuredBattleDescription;
        if (featuredArticleId !== undefined) updateData.featuredArticleId = featuredArticleId;
        if (trendingArtistOverrideId !== undefined) updateData.trendingArtistOverrideId = trendingArtistOverrideId || null;
        if (globalSponsorIds !== undefined) updateData.globalSponsorIds = Array.isArray(globalSponsorIds) ? globalSponsorIds : [];
        if (globalSponsorTitle !== undefined) updateData.globalSponsorTitle = globalSponsorTitle || null;

        const settings = await db.discoverySettings.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', featuredType: featuredType || 'track', ...updateData },
            update: updateData
        });
        // Invalidate cached discovery settings
        apiResponseCache.delete('discovery-settings');
        res.json(settings);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search published articles (for admin featured article picker)
app.get('/api/discovery/articles/search', requireAdmin, async (req: any, res) => {
    try {
        const search = (req.query.q || req.query.search) as string;
        const articles = await db.article.findMany({
            where: {
                status: 'published',
                ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
            },
            orderBy: { publishedAt: 'desc' },
            take: 20,
            select: {
                id: true, title: true, slug: true, excerpt: true,
                coverImageUrl: true, authorName: true, category: true, publishedAt: true,
            },
        });
        res.json({ articles });
    } catch (e: any) {
        logger.error('GET /api/discovery/articles/search error', e);
        res.status(500).json({ error: 'Failed to search articles' });
    }
});

// Search all tracks (for admin featured track picker)
app.get('/api/discovery/tracks/search', publicCache(60), async (req, res) => {
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
        res.status(500).json({ error: 'Internal server error' });
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
            result.note = 'No projectFileUrl \u2014 track has no FLP file';
        }

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
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
        // ── Pass 1: Re-parse plain .flp files ─────────────────────────────────
        const tracksWithFlps = await db.track.findMany({
            where: { projectFileUrl: { not: null } }
        });

        const results = {
            flpTotal: tracksWithFlps.length,
            flpSuccess: 0,
            flpSkippedCloud: 0,
            zipTotal: 0,
            zipSuccess: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const track of tracksWithFlps) {
            try {
                const url = track.projectFileUrl!;
                // Skip cloud-hosted FLPs (R2/CDN) — can't parse without downloading
                if (url.startsWith('http')) {
                    results.flpSkippedCloud++;
                    continue;
                }
                const relativePath = url.startsWith('/') ? url.substring(1) : url;
                const absolutePath = path.join(PROJECT_ROOT, 'public', relativePath);

                logger.info(`Checking FLP at: ${absolutePath}`);

                if (fs.existsSync(absolutePath)) {
                    const flpBuffer = fs.readFileSync(absolutePath);
                    const arrangement = FLPParser.parse(flpBuffer);
                    if (track.bpm && track.bpm > 0) {
                        (arrangement as any).bpm = track.bpm;
                    }
                    logger.info(`FLP re-parse: ${track.title} | BPM: ${(arrangement as any).bpm}`);
                    await db.track.update({ where: { id: track.id }, data: { arrangement: arrangement as any } });
                    results.flpSuccess++;
                } else {
                    results.failed++;
                    results.errors.push(`FLP file not found: ${track.title} (${absolutePath})`);
                }
            } catch (err: any) {
                results.failed++;
                results.errors.push(`FLP error for ${track.title}: ${err.message}`);
            }
        }

        // ── Pass 2: Re-enrich ZIP bundle tracks from TrackSample DB rows ──────
        // The original ZIP processing stores peaks/oggUrl/duration both in TrackSample rows
        // AND embedded in arrangement clip objects. If clip.peaks is missing (e.g. background
        // processing failed or was interrupted), this re-injects them from the DB rows.
        const tracksWithZips = await db.track.findMany({
            where: { projectZipUrl: { not: null }, arrangement: { not: undefined } },
            include: { samples: true }
        }) as any[];

        results.zipTotal = tracksWithZips.length;

        for (const track of tracksWithZips) {
            if (!track.arrangement || !(track.samples as any[]).length) {
                results.failed++;
                results.errors.push(`ZIP track "${track.title}" — no arrangement or no TrackSample rows found`);
                continue;
            }
            try {
                const arr = JSON.parse(JSON.stringify(track.arrangement));
                const sampleMap = new Map<string, any>(
                    (track.samples as any[]).map((s: any) => [s.originalFilename.toLowerCase(), s])
                );
                const clips: any[] = arr.tracks?.flatMap((t: any) => t.clips ?? []) ?? [];
                let enriched = 0;
                for (const clip of clips) {
                    if (clip.type !== 'audio' || !clip.sampleFileName) continue;
                    const sample = sampleMap.get(clip.sampleFileName.toLowerCase());
                    if (sample) {
                        clip.peaks = sample.peaks;
                        clip.oggUrl = sample.oggUrl;
                        clip.duration = sample.duration ?? clip.duration;
                        enriched++;
                    }
                }
                if (track.bpm && track.bpm > 0) arr.bpm = track.bpm;
                await db.track.update({ where: { id: track.id }, data: { arrangement: arr } });
                results.zipSuccess++;
                logger.info(`ZIP re-enrich: "${track.title}" — ${enriched} clips enriched from ${(track.samples as any[]).length} samples`);
            } catch (err: any) {
                results.failed++;
                results.errors.push(`ZIP error for "${track.title}": ${err.message}`);
            }
        }

        res.json(results);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== Genres used in discovery (from actual user profiles) =====
app.get('/api/discovery/genres', publicCache(300), async (req, res) => {
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Avatar upload endpoint
app.post('/api/musician/profile/:userId/avatar', generalUploadLimiter, upload.single('avatar'), async (req: any, res) => {
    try {
        const { userId } = req.params;

        // SEC-02: Ownership check \u2014 only profile owner or admin can upload avatar
        if (req.session?.user?.id !== userId && !(req.session?.mutualAdminGuilds as any)?.length) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'Avatar file is required' });
        }

        // Magic byte validation � reject spoofed images
        try {
            FileValidator.validateImage(fs.readFileSync(file.path), file.originalname);
        } catch (validationErr: any) {
            try { fs.unlinkSync(file.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }

        // Virus scan before processing
        await scanFileForViruses(file.path, 'avatar');

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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User: Upload profile banner image
app.post('/api/musician/profile/:userId/banner', generalUploadLimiter, upload.single('banner'), async (req: any, res) => {
    try {
        const { userId } = req.params;

        // Ownership check � only profile owner or admin
        if (req.session?.user?.id !== userId && !(req.session?.mutualAdminGuilds as any)?.length) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'Banner image file is required' });
        }

        // Magic byte validation
        try {
            FileValidator.validateImage(fs.readFileSync(file.path), file.originalname);
        } catch (validationErr: any) {
            try { fs.unlinkSync(file.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }

        await scanFileForViruses(file.path, 'banner');

        // Convert to WebP
        const finalPath = await MediaConverter.optimizeImage(file.path);

        const profile = await db.musicianProfile.findFirst({ where: { userId } });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Delete old banner from storage
        await deleteFromStorage(profile.bannerUrl);

        const r2Key = `profiles/${profile.id}/banner/${path.basename(finalPath)}`;
        const bannerUrl = await uploadToR2OrLocal(finalPath, r2Key, 'image/webp', `/uploads/avatars/${path.basename(finalPath)}`);

        const updated = await db.musicianProfile.update({
            where: { id: profile.id },
            data: { bannerUrl }
        });

        await logAction('GLOBAL', 'banner_uploaded', userId, profile.id, { url: bannerUrl });

        res.json({ bannerUrl: updated.bannerUrl });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User: Remove profile banner image
app.delete('/api/musician/profile/:userId/banner', async (req: any, res) => {
    try {
        const { userId } = req.params;

        if (req.session?.user?.id !== userId && !(req.session?.mutualAdminGuilds as any)?.length) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const profile = await db.musicianProfile.findFirst({ where: { userId } });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        await deleteFromStorage(profile.bannerUrl);

        await db.musicianProfile.update({
            where: { id: profile.id },
            data: { bannerUrl: null }
        });

        await logAction('GLOBAL', 'banner_removed', userId, profile.id, {});

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Public: Count of active profiles (for social proof copy)
app.get('/api/musician/profiles/count', publicCache(300), async (_req, res) => {
    try {
        const count = await db.musicianProfile.count({ where: { status: 'active', deletedAt: null } });
        res.json({ count });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Public: Search Profiles (for collaborator picker)
app.get('/api/musician/profiles/search', async (req: any, res) => {
    try {
        const { q } = req.query;
        if (!q || String(q).trim().length < 2) return res.json([]);
        const profiles = await db.musicianProfile.findMany({
            where: {
                deletedAt: null,
                status: 'active',
                OR: [
                    { username: { contains: String(q), mode: 'insensitive' } },
                    { displayName: { contains: String(q), mode: 'insensitive' } },
                ],
            },
            select: { id: true, userId: true, username: true, displayName: true, avatar: true },
            take: 10,
        });
        res.json(profiles);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Track Collaborators ────────────────────────────────────────────────────

// List collaborators for a track (public)
app.get('/api/musician/tracks/:trackId/collaborators', async (req, res) => {
    try {
        const { trackId } = req.params;
        const collabs = await db.trackCollaborator.findMany({
            where: { trackId },
            include: { profile: { select: { id: true, userId: true, username: true, displayName: true, avatar: true } } },
            orderBy: { invitedAt: 'asc' },
        });
        res.json(collabs);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add a collaborator (track owner only)
app.post('/api/musician/tracks/:trackId/collaborators', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { trackId } = req.params;
        const { profileId, contribution, category } = req.body;

        if (!profileId || !contribution?.trim()) {
            return res.status(400).json({ error: 'profileId and contribution are required' });
        }

        const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
        if (!track) return res.status(404).json({ error: 'Track not found' });
        if (track.profile.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

        // Can't add yourself
        if (track.profile.id === profileId) {
            return res.status(400).json({ error: 'You cannot add yourself as a collaborator' });
        }

        const collaboratorProfile = await db.musicianProfile.findUnique({ where: { id: profileId } });
        if (!collaboratorProfile) return res.status(404).json({ error: 'Artist not found' });

        const collab = await db.trackCollaborator.upsert({
            where: { trackId_profileId: { trackId, profileId } },
            create: {
                trackId, profileId,
                contribution: contribution.trim(),
                category: category || 'collaboration',
                status: 'pending',
            },
            update: {
                contribution: contribution.trim(),
                category: category || 'collaboration',
                status: 'pending',
                respondedAt: null,
            },
            include: { profile: { select: { id: true, userId: true, username: true, displayName: true, avatar: true } } },
        });

        // Notify the invited artist via MusicNotification
        const ownerProfile = await db.musicianProfile.findUnique({ where: { id: track.profileId }, select: { displayName: true, username: true, avatar: true } });
        const ownerName = ownerProfile?.displayName || ownerProfile?.username || 'Someone';
        db.musicNotification.create({
            data: {
                userId: collaboratorProfile.userId,
                type: 'collab_invite',
                title: `${ownerName} invited you to collaborate`,
                message: `"${track.title}" — ${contribution.trim()}`,
                link: `/track/${track.profile.username}/${track.slug || track.id}`,
                actorId: userId,
                actorName: ownerName,
                actorAvatar: ownerProfile?.avatar || null,
            },
        }).catch(() => {});

        res.json(collab);
    } catch (e: any) {
        if (e.code === 'P2002') return res.status(409).json({ error: 'This artist is already a collaborator' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Accept or reject a collab invite (the invited artist only)
app.patch('/api/musician/tracks/:trackId/collaborators/:collaboratorId', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { trackId, collaboratorId } = req.params;
        const { status } = req.body;

        if (status !== 'accepted' && status !== 'rejected') {
            return res.status(400).json({ error: 'status must be "accepted" or "rejected"' });
        }

        const collab = await db.trackCollaborator.findUnique({
            where: { id: collaboratorId },
            include: { profile: true },
        });
        if (!collab || collab.trackId !== trackId) return res.status(404).json({ error: 'Not found' });
        if (collab.profile.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

        const updated = await db.trackCollaborator.update({
            where: { id: collaboratorId },
            data: { status, respondedAt: new Date() },
            include: { profile: { select: { id: true, userId: true, username: true, displayName: true, avatar: true } } },
        });

        // If accepted, notify the track owner
        if (status === 'accepted') {
            const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
            if (track) {
                const collabProfile = await db.musicianProfile.findUnique({ where: { userId }, select: { displayName: true, username: true, avatar: true } });
                const collabName = collabProfile?.displayName || collabProfile?.username || 'Someone';
                db.musicNotification.create({
                    data: {
                        userId: track.profile.userId,
                        type: 'collab_accepted',
                        title: `${collabName} accepted your collab invite`,
                        message: `"${track.title}"`,
                        link: `/track/${track.profile.username}/${track.slug || track.id}`,
                        actorId: userId,
                        actorName: collabName,
                        actorAvatar: collabProfile?.avatar || null,
                    },
                }).catch(() => {});
            }
        }

        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove a collaborator (track owner only)
app.delete('/api/musician/tracks/:trackId/collaborators/:collaboratorId', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { trackId, collaboratorId } = req.params;

        const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
        if (!track || track.profile.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

        await db.trackCollaborator.deleteMany({ where: { id: collaboratorId, trackId } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// List pending collab invites for the current user
app.get('/api/musician/my-collaborations', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const profile = await db.musicianProfile.findUnique({ where: { userId } });
        if (!profile) return res.json([]);

        const collabs = await db.trackCollaborator.findMany({
            where: { profileId: profile.id },
            include: {
                track: {
                    select: {
                        id: true, title: true, slug: true, coverUrl: true,
                        profile: { select: { userId: true, username: true, displayName: true, avatar: true } },
                    },
                },
            },
            orderBy: { invitedAt: 'desc' },
        });
        res.json(collabs);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Edit any user's profile fields
app.post('/api/admin/musician/profile/:userId', requireAdmin, async (req: any, res) => {
    try {
        const { userId } = req.params;
        const data = req.body;
        const adminId = req.session.user.id;

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
                        return res.status(400).json({ error: 'Artist name contains a restricted word.' });
                    }
                }
            }
        }

        const user = await resolveUser(userId);
        if (!data.username) {
            const fallbackRaw = user?.username
                || (data.displayName as string | undefined)
                || `producer-${userId.slice(-6)}`;
            data.username = fallbackRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `producer-${userId.slice(-6)}`;
        }

        // Validate social link domains
        const socialUrlError2 = validateSocialUrls(data);
        if (socialUrlError2) return res.status(400).json({ error: socialUrlError2 });

        const socials = [
            { platform: 'spotify', url: data.spotifyUrl },
            { platform: 'soundcloud', url: data.soundcloudUrl },
            { platform: 'youtube', url: data.youtubeUrl },
            { platform: 'instagram', url: data.instagramUrl },
            { platform: 'discord', url: data.discordUrl }
        ].filter(s => !!s.url);

        if (!data.genres) data.genres = [];
        const genreIds = data.genres.map((g: any) => typeof g === 'string' ? g : g.id).filter(Boolean);

        const updated = await profileService.updateProfile(userId, {
            ...data,
            socials,
            genreIds,
            featuredTrackId: data.featuredTrackId,
            featuredPlaylistId: data.featuredPlaylistId
        });

        await logAction('GLOBAL', 'profile_admin_edited', adminId, updated.id, {
            username: updated.username,
            targetUserId: userId
        });

        apiResponseCache.delete(`profile-${userId.toLowerCase()}`);
        if (updated.username) apiResponseCache.delete(`profile-${updated.username.toLowerCase()}`);

        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Update avatar for any user's musician profile
app.post('/api/admin/musician/profile/:userId/avatar', requireAdmin, upload.single('avatar'), async (req: any, res) => {
    try {
        const { userId } = req.params;
        const adminId = req.session.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'Avatar file is required' });
        }

        // Magic byte validation
        try {
            FileValidator.validateImage(fs.readFileSync(file.path), file.originalname);
        } catch (validationErr: any) {
            try { fs.unlinkSync(file.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }

        await scanFileForViruses(file.path, 'avatar');
        const finalAvatarPath = await MediaConverter.optimizeImage(file.path);

        const profile = await db.musicianProfile.findFirst({ where: { userId } });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        await deleteFromStorage(profile.avatar);
        const r2AvatarKey = `profiles/${profile.id}/avatar/${path.basename(finalAvatarPath)}`;
        const avatarUrl = await uploadToR2OrLocal(finalAvatarPath, r2AvatarKey, 'image/webp', `/uploads/avatars/${path.basename(finalAvatarPath)}`);

        const updated = await db.musicianProfile.update({
            where: { id: profile.id },
            data: { avatar: avatarUrl }
        });

        await logAction('GLOBAL', 'avatar_admin_uploaded', adminId, profile.id, {
            url: avatarUrl,
            targetUserId: userId
        });

        res.json({ avatar: updated.avatar });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Update banner for any user's musician profile
app.post('/api/admin/musician/profile/:userId/banner', requireAdmin, upload.single('banner'), async (req: any, res) => {
    try {
        const { userId } = req.params;
        const adminId = req.session.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'Banner image file is required' });
        }

        try {
            FileValidator.validateImage(fs.readFileSync(file.path), file.originalname);
        } catch (validationErr: any) {
            try { fs.unlinkSync(file.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }

        await scanFileForViruses(file.path, 'banner');
        const finalPath = await MediaConverter.optimizeImage(file.path);

        const profile = await db.musicianProfile.findFirst({ where: { userId } });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        await deleteFromStorage(profile.bannerUrl);
        const r2Key = `profiles/${profile.id}/banner/${path.basename(finalPath)}`;
        const bannerUrl = await uploadToR2OrLocal(finalPath, r2Key, 'image/webp', `/uploads/avatars/${path.basename(finalPath)}`);

        const updated = await db.musicianProfile.update({
            where: { id: profile.id },
            data: { bannerUrl }
        });

        await logAction('GLOBAL', 'banner_admin_uploaded', adminId, profile.id, {
            url: bannerUrl,
            targetUserId: userId
        });

        res.json({ bannerUrl: updated.bannerUrl });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
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
        if (profile.bannerUrl) await deleteFromStorage(profile.bannerUrl).catch((err: any) =>
            logger.error(`Failed to delete banner during profile wipe: ${profile.bannerUrl}`, err));
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
        res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: List tracks for a profile (including suspended/deleted)
// ─── Admin Account Management ───────────────────────────────────────────────

// GET /api/admin/accounts \u2014 list + search accounts
app.get('/api/admin/accounts', requireAdmin, async (req: any, res) => {
    try {
        const search = (req.query.search as string || '').trim();
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        const where: any = search ? {
            OR: [
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
            ]
        } : {};

        const [rawUsers, total] = await Promise.all([
            db.user.findMany({
                where,
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    email: true,
                    emailVerified: true,
                    totpEnabled: true,
                    discordId: true,
                    passwordHash: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            db.user.count({ where }),
        ]);

        const users = rawUsers.map(({ passwordHash, ...u }) => ({ ...u, hasPassword: !!passwordHash }));
        res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/accounts/:id \u2014 full account detail
app.get('/api/admin/accounts/:id', requireAdmin, async (req: any, res) => {
    try {
        const rawUser = await db.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                username: true,
                displayName: true,
                email: true,
                emailVerified: true,
                totpEnabled: true,
                discordId: true,
                passwordHash: true,
                pendingEmail: true,
                createdAt: true,
                updatedAt: true,
                passwordResetExpiry: true,
            },
        });
        if (!rawUser) return res.status(404).json({ error: 'User not found' });
        const { passwordHash: _ph, ...userFields } = rawUser;
        res.json({ ...userFields, hasPassword: !!rawUser.passwordHash });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/admin/accounts/:id \u2014 update account fields
app.put('/api/admin/accounts/:id', requireAdmin, async (req: any, res) => {
    try {
        const { username, email, displayName } = req.body;
        const targetId = req.params.id;

        const updates: any = {};

        if (typeof username === 'string') {
            const usernameClean = username.trim();
            if (!/^[a-zA-Z0-9_-]{3,30}$/.test(usernameClean)) {
                return res.status(400).json({ error: 'Username must be 3-30 characters (letters, numbers, - or _)' });
            }
            const existing = await db.user.findFirst({
                where: { username: { equals: usernameClean, mode: 'insensitive' }, NOT: { id: targetId } }
            });
            if (existing) return res.status(409).json({ error: 'Username already taken' });
            updates.username = usernameClean;
        }

        if (typeof email === 'string') {
            const emailClean = email.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
                return res.status(400).json({ error: 'Invalid email address' });
            }
            const existing = await db.user.findFirst({
                where: { email: emailClean, NOT: { id: targetId } }
            });
            if (existing) return res.status(409).json({ error: 'Email already in use' });
            updates.email = emailClean;
            updates.emailVerified = new Date(); // admin setting email counts as verified
        }

        if (typeof displayName === 'string') {
            updates.displayName = displayName.trim().slice(0, 64) || null;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const updated = await db.user.update({ where: { id: targetId }, data: updates });
        res.json({ success: true, user: { id: updated.id, username: updated.username, email: updated.email, displayName: updated.displayName } });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/admin/accounts/:id \u2014 delete account (cannot delete self)
app.delete('/api/admin/accounts/:id', requireAdmin, async (req: any, res) => {
    try {
        const targetId = req.params.id;
        const adminDiscordId = req.session.user?.id;
        if (adminDiscordId) {
            const adminUser = await db.user.findUnique({ where: { discordId: adminDiscordId } });
            if (adminUser && adminUser.id === targetId) {
                return res.status(400).json({ error: 'You cannot delete your own account via admin panel' });
            }
        }
        await db.user.delete({ where: { id: targetId } });
        res.json({ success: true });
    } catch (e: any) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'User not found' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/admin/accounts/:id/force-verify \u2014 mark email as verified
app.post('/api/admin/accounts/:id/force-verify', requireAdmin, async (req: any, res) => {
    try {
        await db.user.update({
            where: { id: req.params.id },
            data: { emailVerified: new Date() },
        });
        res.json({ success: true });
    } catch (e: any) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'User not found' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/admin/accounts/:id/send-password-reset \u2014 send password reset email
app.post('/api/admin/accounts/:id/send-password-reset', requireAdmin, async (req: any, res) => {
    try {
        const user = await db.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.email) return res.status(400).json({ error: 'User has no email address' });

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.user.update({
            where: { id: user.id },
            data: { passwordResetToken: token, passwordResetExpiry: expiry },
        });

        let resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) { try { const s = await emailService.getSettings(); resendKey = s.resendApiKey; } catch {} }
        if (!resendKey) return res.status(500).json({ error: 'Email service not configured' });

        const dashboardOrigin = process.env.DASHBOARD_ORIGIN || 'https://fujistud.io';
        const resetLink = `${dashboardOrigin}/reset-password?token=${token}`;
        const resendClient = new Resend(resendKey);
        await resendClient.emails.send({
            from: 'Fuji Studio <noreply@fujistud.io>',
            to: [user.email],
            subject: 'Reset your Fuji Studio password',
            html: wrapEmailHtml(`<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1e2e;border-radius:16px;color:#e2e8f0;">
                <h2 style="color:#2b8d70;margin-top:0;">Password Reset</h2>
                <p>Hey <strong>${user.displayName || user.username}</strong>,</p>
                <p>An admin has initiated a password reset for your account. Click below to set a new password. This link expires in 24 hours.</p>
                <a href="${resetLink}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#2b8d70;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Reset Password</a>
                <p style="color:#8A92A0;font-size:13px;">If you didn't request this, contact your server admin.</p>
            </div>`),
        });

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/admin/accounts/:id/disable-2fa \u2014 disable TOTP
app.post('/api/admin/accounts/:id/disable-2fa', requireAdmin, async (req: any, res) => {
    try {
        await db.user.update({
            where: { id: req.params.id },
            data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] },
        });
        res.json({ success: true });
    } catch (e: any) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'User not found' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/admin/accounts/:id/remove-discord \u2014 unlink Discord
app.post('/api/admin/accounts/:id/remove-discord', requireAdmin, async (req: any, res) => {
    try {
        await db.user.update({
            where: { id: req.params.id },
            data: { discordId: null },
        });
        res.json({ success: true });
    } catch (e: any) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'User not found' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/admin/accounts/:id/set-password \u2014 admin sets password directly
app.post('/api/admin/accounts/:id/set-password', requireAdmin, async (req: any, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        const hash = await new Promise<string>((resolve, reject) => {
            const salt = crypto.randomBytes(16).toString('hex');
            crypto.scrypt(newPassword, salt, 64, (err, key) => {
                if (err) return reject(err);
                resolve(`${salt}:${key.toString('hex')}`);
            });
        });
        await db.user.update({
            where: { id: req.params.id },
            data: { passwordHash: hash },
        });
        res.json({ success: true });
    } catch (e: any) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'User not found' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── End Admin Account Management ────────────────────────────────────────────

app.get('/api/admin/musician/profiles/:id/tracks', requireAdmin, async (req: any, res) => {
    try {
        const { id } = req.params;
        const tracks = await db.track.findMany({
            where: {
                profileId: id,
                // Bypass soft-delete middleware: show all tracks including deleted
                OR: [{ deletedAt: null }, { deletedAt: { not: null } }],
            },
            select: {
                id: true,
                title: true,
                coverUrl: true,
                status: true,
                statusReason: true,
                playCount: true,
                isPublic: true,
                deletedAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tracks);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
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
app.get('/api/fuji/download/:attachmentId', requireAuth, async (req: any, res) => {
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

        await logDownload(req, 'sample', undefined, sample.filename);

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
        res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.API_PORT || 3001;

// Backup timestamps — persisted to disk so they survive API restarts
const BACKUP_STAMP_FILE = path.join(process.cwd(), 'data', 'backup-stamps.json');
const _loadBackupStamps = (): { manual: number | null; scheduled: number | null } => {
    try {
        const raw = fs.readFileSync(BACKUP_STAMP_FILE, 'utf8');
        return JSON.parse(raw);
    } catch { return { manual: null, scheduled: null }; }
};
const _saveBackupStamps = () => {
    try {
        fs.mkdirSync(path.dirname(BACKUP_STAMP_FILE), { recursive: true });
        fs.writeFileSync(BACKUP_STAMP_FILE, JSON.stringify({ manual: manualBackupLastAt, scheduled: scheduledBackupLastAt }));
    } catch { /* non-fatal */ }
};
const _stamps = _loadBackupStamps();
let manualBackupLastAt: number | null = _stamps.manual;
let scheduledBackupLastAt: number | null = _stamps.scheduled;

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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════════
// Beat Battle API
// ═══════════════════════════════════════════════════

// --- Public: List battles (with filtering) ---
// NOTE: NOT cached. Vote tallies and entry counts must update in real time so users
// see immediate feedback after voting. Caching here causes stale highlight/score state.
app.get('/api/beat-battle/battles', async (req: any, res) => {
    try {
        // Explicit no-store: prevents Cloudflare/browser from holding a stale snapshot
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
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
                _count: { select: { entries: { where: { deletedAt: null } } } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(battles);

        // Fire-and-forget analytics (don't block the response)
        if (req.session?.user?.id) {
            const activeBattle = battles.find((b: any) => b.status !== 'completed');
            if (activeBattle) {
                db.battleAnalytics.create({
                    data: { battleId: activeBattle.id, eventType: 'page_view', userId: req.session.user.id },
                }).catch(() => {});
            }
        }
    } catch (e: any) {
        logger.error('Beat Battle API: list battles failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Public: Get single battle with entries ---
// NOT cached — vote tallies must update in real time.
app.get('/api/beat-battle/battles/:id', async (req: any, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        const idOrSlug = req.params.id;
        const battle = await db.beatBattle.findFirst({
            where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
            include: {
                sponsor: { include: { links: true } },
                entries: {
                    where: { deletedAt: null },
                    orderBy: [{ voteCount: 'desc' }, { createdAt: 'asc' }],
                    select: {
                        id: true, userId: true, voteCount: true, source: true, createdAt: true,
                        track: {
                            select: {
                                id: true, title: true, slug: true, url: true, coverUrl: true,
                                description: true, duration: true, bpm: true, key: true, artist: true,
                                arrangement: true, waveformPeaks: true,
                                projectFileUrl: true, projectZipUrl: true,
                                allowAudioDownload: true, allowProjectDownload: true,
                                profile: { select: { id: true, username: true, displayName: true, avatar: true, userId: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!battle) return res.status(404).json({ error: 'Battle not found' });

        // Per-rank vote tallies for ranked voting (Lexicographical Positional Scoring)
        const tallies = await db.battleVote.groupBy({
            by: ['entryId', 'rank'],
            where: { battleId: battle.id },
            _count: { _all: true },
        });
        const tallyMap = new Map<string, { first: number; second: number; third: number }>();
        for (const t of tallies as any[]) {
            const cur = tallyMap.get(t.entryId) || { first: 0, second: 0, third: 0 };
            if (t.rank === 1) cur.first = t._count._all;
            else if (t.rank === 2) cur.second = t._count._all;
            else if (t.rank === 3) cur.third = t._count._all;
            tallyMap.set(t.entryId, cur);
        }
        const enrichedEntries = (battle as any).entries.map((e: any) => {
            const t = tallyMap.get(e.id) || { first: 0, second: 0, third: 0 };
            return { ...e, firstPlaceVotes: t.first, secondPlaceVotes: t.second, thirdPlaceVotes: t.third };
        });

        // Include discordInviteUrl from guild settings
        const guildSettings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } }).catch(() => null);

        const suddenDeathEntryIds: string[] = Array.isArray((battle as any).suddenDeathEntryIds)
            ? (battle as any).suddenDeathEntryIds
            : [];
        res.json({
            ...battle,
            entries: enrichedEntries,
            discordInviteUrl: guildSettings?.discordInviteUrl || null,
            suddenDeath: battle.status === 'sudden_death' ? {
                active: true,
                entryIds: suddenDeathEntryIds,
                start: (battle as any).suddenDeathStart,
                end: (battle as any).suddenDeathEnd,
                durationMinutes: (battle as any).suddenDeathDurationMinutes,
            } : null,
        });

        // Fire-and-forget analytics (don't block the response)
        if (req.session?.user?.id) {
            db.battleAnalytics.create({
                data: { battleId: battle.id, eventType: 'page_view', userId: req.session.user.id },
            }).catch(() => {});
        }
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Auth: Get current user's ranked votes for a battle ---
app.get('/api/beat-battle/battles/:id/my-votes', requireAuth, async (req: any, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const userId = req.session.user.id;
        const idOrSlug = req.params.id;
        const battle = await db.beatBattle.findFirst({
            where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
            select: { id: true },
        });
        if (!battle) return res.status(404).json({ error: 'Battle not found' });
        const votes = await db.battleVote.findMany({
            where: { userId, battleId: battle.id },
            select: { entryId: true, rank: true },
        });
        // Back-compat: include flat list of voted entry IDs
        res.json({
            votes,
            votedEntryIds: votes.map((v: { entryId: string }) => v.entryId),
        });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Auth: List active battles a Track has been entered into (for submit modal warning) ---
app.get('/api/beat-battle/tracks/:trackId/battles', requireAuth, async (req: any, res) => {
    try {
        const trackId = req.params.trackId;
        const entries = await db.battleEntry.findMany({
            where: { trackId, deletedAt: null },
            select: {
                id: true,
                battle: { select: { id: true, title: true, slug: true, status: true } },
            },
        });
        res.json(entries.map((e: any) => ({
            entryId: e.id,
            battleId: e.battle.id,
            battleTitle: e.battle.title,
            battleSlug: e.battle.slug,
            battleStatus: e.battle.status,
        })));
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Public: Get archive (completed battles) ---
app.get('/api/beat-battle/archive', publicCache(120), async (req: any, res) => {
    try {
        const guildId = req.query.guildId as string | undefined;
        const archiveWhere: any = { status: 'completed' };
        if (guildId && guildId !== 'default-guild') archiveWhere.guildId = guildId;
        const battles = await db.beatBattle.findMany({
            where: archiveWhere,
            include: {
                sponsor: true,
                entries: {
                    where: { deletedAt: null },
                    orderBy: [{ voteCount: 'desc' }, { createdAt: 'asc' }],
                    take: 3,
                    select: {
                        id: true, userId: true, voteCount: true,
                        track: {
                            select: {
                                id: true, title: true, url: true, coverUrl: true,
                                profile: { select: { username: true, displayName: true, avatar: true, userId: true } },
                            },
                        },
                    },
                },
                _count: { select: { entries: { where: { deletedAt: null } } } },
            },
            orderBy: { updatedAt: 'desc' },
        });
        res.json(battles);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Public: Get single entry with battle context ---
app.get('/api/beat-battle/entries/:entryId', publicCache(60), async (req: any, res) => {
    try {
        const entry = await db.battleEntry.findUnique({
            where: { id: req.params.entryId },
            include: {
                battle: {
                    select: { id: true, title: true, status: true, description: true, guildId: true },
                },
                track: {
                    select: {
                        id: true, title: true, slug: true, url: true, coverUrl: true,
                        description: true, artist: true, album: true, year: true,
                        bpm: true, key: true, duration: true, playCount: true,
                        allowAudioDownload: true, allowProjectDownload: true,
                        projectFileUrl: true, projectZipUrl: true,
                        arrangement: true, waveformPeaks: true, createdAt: true,
                        license: true, lyrics: true, lyricsSync: true,
                        profile: { select: { id: true, username: true, displayName: true, userId: true, avatar: true } },
                        genres: { include: { genre: true } },
                        samples: true,
                    },
                },
            },
        });

        if (!entry) return res.status(404).json({ error: 'Entry not found' });

        res.json(entry);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Auth: Cast / change / clear a ranked vote on an entry ---
// Body: { rank: 1 | 2 | 3 | null }
//   rank=1|2|3 ? assign that rank slot to this entry for the user.
//                Any previous entry in the same rank slot is cleared.
//                If the user previously had a different rank on this entry, it's updated.
//   rank=null  ? clear the user's vote on this entry entirely.
// Sudden-death battles only accept rank=1 and only on tied entries.
app.post('/api/beat-battle/entries/:entryId/vote', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const entryId = req.params.entryId;
        const rawRank = req.body?.rank;
        const rank: 1 | 2 | 3 | null = rawRank === null || rawRank === undefined
            ? null
            : (rawRank === 1 || rawRank === 2 || rawRank === 3 ? rawRank : null);
        if (rawRank !== null && rawRank !== undefined && rank === null) {
            return res.status(400).json({ error: 'rank must be 1, 2, 3, or null' });
        }

        const entry = await db.battleEntry.findUnique({
            where: { id: entryId },
            include: { battle: true },
        });
        if (!entry) return res.status(404).json({ error: 'Entry not found' });

        const isVoting = entry.battle.status === 'voting';
        const isSuddenDeath = entry.battle.status === 'sudden_death';
        if (!isVoting && !isSuddenDeath) {
            return res.status(400).json({ error: 'Voting is not open for this battle' });
        }
        if (entry.userId === userId) {
            return res.status(400).json({ error: 'You cannot vote for your own submission' });
        }
        if (isSuddenDeath) {
            const tied: string[] = Array.isArray((entry.battle as any).suddenDeathEntryIds)
                ? (entry.battle as any).suddenDeathEntryIds : [];
            if (!tied.includes(entryId)) {
                return res.status(400).json({ error: 'This entry is not part of the sudden-death runoff' });
            }
            if (rank !== null && rank !== 1) {
                return res.status(400).json({ error: 'Sudden death only accepts a single (1st place) vote' });
            }
        }

        // Clear path
        if (rank === null) {
            const existing = await db.battleVote.findUnique({ where: { entryId_userId: { entryId, userId } } });
            if (!existing) return res.json({ cleared: true, votes: await fetchUserVotes(entry.battleId, userId) });
            await db.$transaction(async (tx) => {
                await tx.battleVote.delete({ where: { entryId_userId: { entryId, userId } } });
                await tx.battleEntry.update({ where: { id: entryId }, data: { voteCount: { decrement: 1 } } });
            });
            return res.json({ cleared: true, votes: await fetchUserVotes(entry.battleId, userId) });
        }

        // Assign / move rank
        await db.$transaction(async (tx) => {
            // 1. Remove any other entry currently holding this rank for this user in this battle
            const conflict = await tx.battleVote.findUnique({
                where: { battleId_userId_rank: { battleId: entry.battleId, userId, rank } },
            });
            if (conflict && conflict.entryId !== entryId) {
                await tx.battleVote.delete({ where: { id: conflict.id } });
                await tx.battleEntry.update({ where: { id: conflict.entryId }, data: { voteCount: { decrement: 1 } } });
            }
            // 2. Upsert this user's vote on this entry
            const existing = await tx.battleVote.findUnique({ where: { entryId_userId: { entryId, userId } } });
            if (existing) {
                if (existing.rank !== rank) {
                    await tx.battleVote.update({ where: { id: existing.id }, data: { rank } });
                }
            } else {
                await tx.battleVote.create({
                    data: { entryId, battleId: entry.battleId, userId, rank, source: 'web' },
                });
                await tx.battleEntry.update({ where: { id: entryId }, data: { voteCount: { increment: 1 } } });
                await tx.battleAnalytics.create({
                    data: { battleId: entry.battleId, eventType: 'vote_cast', userId },
                });
            }
        });

        // Economy reward only on first-time vote in this battle
        try {
            if (entry.battle.voterReward && entry.battle.voterReward > 0) {
                const totalVotes = await db.battleVote.count({ where: { battleId: entry.battleId, userId } });
                if (totalVotes === 1) {
                    await db.economyAccount.upsert({
                        where: { guildId_userId: { guildId: entry.battle.guildId, userId } },
                        update: {
                            balance: { increment: entry.battle.voterReward },
                            totalEarned: { increment: entry.battle.voterReward },
                        },
                        create: {
                            guildId: entry.battle.guildId, userId,
                            balance: entry.battle.voterReward, totalEarned: entry.battle.voterReward,
                        },
                    });
                }
            }
        } catch { /* non-critical */ }

        res.json({ rank, votes: await fetchUserVotes(entry.battleId, userId) });
    } catch (e: any) {
        logger.error('Beat Battle API: vote failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function fetchUserVotes(battleId: string, userId: string) {
    return db.battleVote.findMany({
        where: { battleId, userId },
        select: { entryId: true, rank: true },
    });
}

// --- Admin: Delete a battle entry ---
app.delete('/api/beat-battle/entries/:entryId', requireAdmin, async (req: any, res) => {
    try {
        const { entryId } = req.params;
        const entry = await db.battleEntry.findUnique({ where: { id: entryId } });
        if (!entry) return res.status(404).json({ error: 'Entry not found' });
        // Delete votes + entry atomically
        await db.$transaction(async (tx) => {
            await tx.battleVote.deleteMany({ where: { entryId } });
            await tx.battleEntry.delete({ where: { id: entryId } });
        });
        res.json({ success: true });
    } catch (e: any) {
        logger.error('Beat Battle API: delete entry failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Auth: Submit entry via web (upload or library track) ---
// Battle submission is now a thin "link a Track to a Battle" operation.
// Clients upload new tracks via /api/musician/tracks first, then POST the trackId here.
app.post('/api/beat-battle/battles/:battleId/submit', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const battleId = req.params.battleId;
        const { trackId } = req.body || {};

        if (!trackId || typeof trackId !== 'string') {
            return res.status(400).json({ error: 'trackId is required' });
        }

        if (process.env.GUILD_ID && !req.session.isGuildMember) {
            return res.status(403).json({ error: 'You must be a member of the Discord server to submit battle entries.' });
        }

        const battle = await db.beatBattle.findUnique({ where: { id: battleId } });
        if (!battle) return res.status(404).json({ error: 'Battle not found' });
        if (battle.status !== 'active') return res.status(400).json({ error: 'This battle is not accepting submissions' });

        const track = await db.track.findUnique({
            where: { id: trackId },
            include: { profile: true },
        });
        if (!track) return res.status(404).json({ error: 'Track not found' });
        if (track.profile.userId !== userId) {
            return res.status(403).json({ error: 'You can only submit your own tracks' });
        }
        if (track.status !== 'active' || track.deletedAt) {
            return res.status(400).json({ error: 'This track is not eligible for submission' });
        }
        if (!track.isPublic) {
            return res.status(400).json({
                error: 'This track is private. Make it public from your track page before submitting it to a battle.',
                code: 'TRACK_PRIVATE',
                trackId: track.id,
            });
        }
        if (battle.requireProjectFile && !track.projectFileUrl && !track.projectZipUrl) {
            return res.status(400).json({ error: 'This battle requires a project file. Add a .flp/.zip to your track first.' });
        }

        const guildSettings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
        if (guildSettings?.requireMusicianProfile && !track.profile) {
            return res.status(403).json({ error: 'A musician profile is required to submit.' });
        }

        const existing = await db.battleEntry.findFirst({
            where: { battleId, userId, deletedAt: null },
        });
        if (existing) return res.status(400).json({ error: 'You already submitted to this battle' });

        if (battle.entryFeeEnabled && battle.entryFee > 0) {
            const account = await db.economyAccount.findUnique({
                where: { guildId_userId: { guildId: battle.guildId, userId } },
            });
            const balance = account?.balance ?? 0;
            if (balance < battle.entryFee) {
                const economySettings = await db.economySettings.findUnique({ where: { guildId: battle.guildId } });
                const emoji = economySettings?.currencyEmoji || '🪙';
                return res.status(400).json({ error: `You need ${emoji}${battle.entryFee} to enter this battle (you have ${emoji}${balance})` });
            }
            await db.economyAccount.update({
                where: { guildId_userId: { guildId: battle.guildId, userId } },
                data: { balance: { decrement: battle.entryFee } },
            });
            await db.economyTransaction.create({
                data: {
                    guildId: battle.guildId,
                    amount: battle.entryFee,
                    type: 'BATTLE_ENTRY',
                    reason: `Entry fee for "${battle.title}"`,
                    fromUserId: userId,
                },
            });
        }

        const entry = await db.battleEntry.create({
            data: {
                battleId,
                userId,
                trackId,
                source: 'web',
            },
            include: { track: { include: { profile: true } } },
        });

        await db.battleAnalytics.create({
            data: { battleId, eventType: 'submission', userId },
        }).catch(() => {});

        res.json(entry);
    } catch (e: any) {
        logger.error('Beat Battle API: web submit failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin: Create battle ---
app.post('/api/beat-battle/admin/battles', requireAdmin, async (req: any, res) => {
    try {
        const { title, description, subtitle, rules, rulesData, prizes, guildId, submissionStart, submissionEnd, votingStart, votingEnd, sponsorId, announcementChannelId, maxVotesPerUser, requireProjectFile, entryFeeEnabled, entryFee, prizePoolEnabled, prizeFirst, prizeSecond, prizeThird, voterReward, suddenDeathDurationMinutes } = req.body;

        if (!title) return res.status(400).json({ error: 'Title is required' });

        const effectiveGuildId = guildId || 'default-guild';

        // Generate unique slug from title (always append random suffix to prevent races/empty-slug collisions)
        const rawSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const baseSlug = rawSlug || 'battle';
        const randomSuffix = Math.random().toString(36).slice(2, 7);
        let slug = `${baseSlug}-${randomSuffix}`;
        // Extremely unlikely collision guard
        while (await db.beatBattle.findFirst({ where: { slug } })) {
            slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
        }

        const battle = await db.beatBattle.create({
            data: {
                guildId: effectiveGuildId,
                title,
                slug,
                description,
                subtitle: subtitle || null,
                rules: rules || (Array.isArray(rulesData) ? rulesData.map((r: any) => r.text || '').filter(Boolean).join('\n') : null),
                rulesData: rulesData || null,
                prizes: prizes || [],
                status: submissionStart && new Date(submissionStart) > new Date() ? 'upcoming' : 'active',
                submissionStart: submissionStart ? new Date(submissionStart) : new Date(),
                submissionEnd: submissionEnd ? new Date(submissionEnd) : null,
                votingStart: votingStart ? new Date(votingStart) : null,
                votingEnd: votingEnd ? new Date(votingEnd) : null,
                sponsorId: sponsorId || null,
                announcementChannelId: announcementChannelId || null,
                maxVotesPerUser: maxVotesPerUser != null ? Number(maxVotesPerUser) : 0,
                requireProjectFile: requireProjectFile === true || requireProjectFile === 'true',
                entryFeeEnabled: entryFeeEnabled === true,
                entryFee: entryFee != null ? Number(entryFee) : 0,
                prizePoolEnabled: prizePoolEnabled === true,
                prizeFirst: prizeFirst != null ? Number(prizeFirst) : 0,
                prizeSecond: prizeSecond != null ? Number(prizeSecond) : 0,
                prizeThird: prizeThird != null ? Number(prizeThird) : 0,
                voterReward: voterReward != null ? Number(voterReward) : 0,
                suddenDeathDurationMinutes: suddenDeathDurationMinutes != null && Number(suddenDeathDurationMinutes) > 0 ? Number(suddenDeathDurationMinutes) : 60,
                createdBy: req.session.user.id,
            },
            include: { sponsor: { include: { links: true } } },
        });

        apiResponseCache.delete('battles-list');

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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin: Update battle ---
app.patch('/api/beat-battle/admin/battles/:id', requireAdmin, async (req: any, res) => {
    try {
        const { title, description, subtitle, rules, rulesData, prizes, status, submissionStart, submissionEnd, votingStart, votingEnd, sponsorId, announcementChannelId, maxVotesPerUser, requireProjectFile, entryFeeEnabled, entryFee, prizePoolEnabled, prizeFirst, prizeSecond, prizeThird, voterReward, suddenDeathDurationMinutes } = req.body;

        // Fetch old battle to detect status change
        const oldBattle = await db.beatBattle.findUnique({ where: { id: req.params.id } });
        if (!oldBattle) return res.status(404).json({ error: 'Battle not found' });

        const data: any = {};
        if (title !== undefined) {
            data.title = title;
            // Regenerate slug; allow collision suffix
            const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            let slug = baseSlug;
            let suffix = 2;
            while (await db.beatBattle.findFirst({ where: { slug, NOT: { id: req.params.id } } })) {
                slug = `${baseSlug}-${suffix++}`;
            }
            data.slug = slug;
        }
        if (description !== undefined) data.description = description;
        if (subtitle !== undefined) data.subtitle = subtitle || null;
        if (rules !== undefined) data.rules = rules;
        if (rulesData !== undefined) {
            data.rulesData = rulesData;
            // keep plain-text rules in sync for backward compat
            if (Array.isArray(rulesData)) data.rules = rulesData.map((r: any) => r.text || '').filter(Boolean).join('\n');
        }
        if (prizes !== undefined) data.prizes = prizes;
        if (status !== undefined) data.status = status;
        if (submissionStart !== undefined) data.submissionStart = submissionStart ? new Date(submissionStart) : null;
        if (submissionEnd !== undefined) data.submissionEnd = submissionEnd ? new Date(submissionEnd) : null;
        if (votingStart !== undefined) data.votingStart = votingStart ? new Date(votingStart) : null;
        if (votingEnd !== undefined) data.votingEnd = votingEnd ? new Date(votingEnd) : null;
        if (sponsorId !== undefined) data.sponsorId = sponsorId || null;
        if (announcementChannelId !== undefined) data.announcementChannelId = announcementChannelId;
        if (maxVotesPerUser !== undefined) data.maxVotesPerUser = Number(maxVotesPerUser);
        if (requireProjectFile !== undefined) data.requireProjectFile = requireProjectFile === true || requireProjectFile === 'true';
        if (entryFeeEnabled !== undefined) data.entryFeeEnabled = entryFeeEnabled === true;
        if (entryFee !== undefined) data.entryFee = Number(entryFee);
        if (prizePoolEnabled !== undefined) data.prizePoolEnabled = prizePoolEnabled === true;
        if (prizeFirst !== undefined) data.prizeFirst = Number(prizeFirst);
        if (prizeSecond !== undefined) data.prizeSecond = Number(prizeSecond);
        if (prizeThird !== undefined) data.prizeThird = Number(prizeThird);
        if (voterReward !== undefined) data.voterReward = Number(voterReward);
        if (suddenDeathDurationMinutes !== undefined) {
            const v = Number(suddenDeathDurationMinutes);
            data.suddenDeathDurationMinutes = Number.isFinite(v) && v > 0 ? v : 60;
        }

        const battle = await db.beatBattle.update({
            where: { id: req.params.id },
            data,
            include: { sponsor: { include: { links: true } } },
        });

        // --- Trigger lifecycle side-effects on manual status change ---
        const newStatus = status;
        const statusChanged = newStatus && newStatus !== oldBattle.status;
        if (statusChanged) {
            // → Completed: pick winner by total points (ranked voting)
            if (newStatus === 'completed') {
                const ranked = await rankedBattleEntries(battle.id, 1);
                const winner = ranked[0];
                if (winner) {
                    await db.beatBattle.update({ where: { id: battle.id }, data: { winnerEntryId: winner.id } });
                }
            }

            // Post announcement for the new status
            const settings2 = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
            await postBattleAnnouncement(battle, settings2);
        }

        apiResponseCache.delete('battles-list');

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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin: Delete battle ---
app.delete('/api/beat-battle/admin/battles/:id', requireAdmin, async (req: any, res) => {
    try {
        const battle = await db.beatBattle.findUnique({ where: { id: req.params.id } });
        if (!battle) return res.status(404).json({ error: 'Battle not found' });

        await db.beatBattle.delete({ where: { id: req.params.id } });

        apiResponseCache.delete('battles-list');

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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Public: Get battle submissions for a user (profile) ---
app.get('/api/beat-battle/user/:userId/entries', publicCache(60), async (req: any, res) => {
    try {
        const entries = await db.battleEntry.findMany({
            where: { userId: req.params.userId },
            include: {
                battle: {
                    select: { id: true, title: true, status: true, slug: true, winnerEntryId: true },
                },
                track: {
                    select: {
                        id: true, title: true, slug: true, url: true, coverUrl: true,
                        profile: { select: { username: true, displayName: true, avatar: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (entries.length === 0) return res.json([]);

        // Batch: fetch all entries for all relevant battles in ONE query (eliminates N+1)
        const battleIds = [...new Set(entries.map((e: any) => e.battleId))];
        const allBattleEntries = await db.battleEntry.findMany({
            where: { battleId: { in: battleIds }, deletedAt: null },
            select: { id: true, battleId: true, voteCount: true, createdAt: true },
        });

        // Per-rank vote tallies for every entry in those battles (points: 1st=3, 2nd=2, 3rd=1)
        const tallies = await db.battleVote.groupBy({
            by: ['entryId', 'rank'],
            where: { battleId: { in: battleIds } },
            _count: { _all: true },
        });
        const rankMap = new Map<string, { first: number; second: number; third: number }>();
        for (const t of tallies as any[]) {
            const cur = rankMap.get(t.entryId) || { first: 0, second: 0, third: 0 };
            if (t.rank === 1) cur.first = t._count._all;
            else if (t.rank === 2) cur.second = t._count._all;
            else if (t.rank === 3) cur.third = t._count._all;
            rankMap.set(t.entryId, cur);
        }
        const pointsFor = (id: string) => {
            const r = rankMap.get(id) || { first: 0, second: 0, third: 0 };
            return { ...r, points: r.first * 3 + r.second * 2 + r.third * 1 };
        };

        // Group by battleId and rank by points (with tiebreakers) for placement
        const rankedByBattle = new Map<string, { id: string; voteCount: number; points: number }[]>();
        for (const e of allBattleEntries) {
            const list = rankedByBattle.get(e.battleId) || [];
            const pts = pointsFor(e.id);
            list.push({ id: e.id, voteCount: e.voteCount, points: pts.points });
            rankedByBattle.set(e.battleId, list);
        }
        for (const [bid, list] of rankedByBattle) {
            list.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                const ra = pointsFor(a.id), rb = pointsFor(b.id);
                if (rb.first !== ra.first) return rb.first - ra.first;
                if (rb.second !== ra.second) return rb.second - ra.second;
                return 0;
            });
            rankedByBattle.set(bid, list);
        }

        const enriched = entries.map((entry: any) => {
            const battleEntries = rankedByBattle.get(entry.battleId) || [];
            const placement = battleEntries.findIndex((e: any) => e.id === entry.id) + 1;
            const totalEntries = battleEntries.length;
            const winnerId = entry.battle.winnerEntryId;
            const isWinner = entry.battle.status === 'completed' && (
                winnerId ? winnerId === entry.id : (placement === 1 && (battleEntries[0]?.points || 0) > 0)
            );
            const tally = pointsFor(entry.id);
            const t = entry.track || {};
            const p = t.profile || {};
            const trackRoute = (p.username && (t.slug || t.id))
                ? `/track/${p.username}/${t.slug || t.id}`
                : `/battles/entry/${entry.id}`;
            return {
                id: entry.id,
                trackId: t.id ?? entry.trackId,
                trackTitle: t.title ?? entry.trackTitle ?? 'Untitled',
                audioUrl: t.url ?? entry.audioUrl ?? '',
                coverUrl: t.coverUrl ?? entry.coverUrl ?? null,
                avatarUrl: p.avatar ?? entry.avatarUrl ?? null,
                voteCount: entry.voteCount,
                points: tally.points,
                firstPlaceVotes: tally.first,
                secondPlaceVotes: tally.second,
                thirdPlaceVotes: tally.third,
                createdAt: entry.createdAt,
                battle: entry.battle,
                placement,
                totalEntries,
                isWinner,
                trackRoute,
            };
        });

        res.json(enriched);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Auth: Get current user's library tracks (for battle submission picker) ---
app.get('/api/beat-battle/my-tracks', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const profile = await db.musicianProfile.findFirst({ where: { userId } });
        if (!profile) return res.json([]);
        const tracks = await db.track.findMany({
            where: { profileId: profile.id, status: 'active' },
            select: { id: true, title: true, url: true, coverUrl: true, duration: true, artist: true, projectFileUrl: true, isPublic: true },
            orderBy: { createdAt: 'desc' },
        });
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.json(tracks);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Shared helper: rank a battle's entries by total points (ranked voting) ---
// Rank 1 = 3 pts, rank 2 = 2 pts, rank 3 = 1 pt.
// Tiebreakers: more 1st-place votes → more 2nd-place votes → earliest submission.
async function rankedBattleEntries(battleId: string, take = 10): Promise<{
    id: string; userId: string; trackTitle: string; points: number;
    firstVotes: number; secondVotes: number; thirdVotes: number; createdAt: Date;
}[]> {
    const entries = await db.battleEntry.findMany({
        where: { battleId, deletedAt: null },
        select: {
            id: true, userId: true, createdAt: true, trackTitle: true,
            track: { select: { title: true } },
            votes: { select: { rank: true } },
        },
    });
    const scored = entries.map((e: any) => {
        let first = 0, second = 0, third = 0;
        for (const v of e.votes) {
            if (v.rank === 1) first++;
            else if (v.rank === 2) second++;
            else if (v.rank === 3) third++;
        }
        return {
            id: e.id,
            userId: e.userId,
            trackTitle: e.track?.title || e.trackTitle || 'Untitled',
            points: first * 3 + second * 2 + third * 1,
            firstVotes: first,
            secondVotes: second,
            thirdVotes: third,
            createdAt: e.createdAt,
        };
    });
    scored.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.firstVotes !== a.firstVotes) return b.firstVotes - a.firstVotes;
        if (b.secondVotes !== a.secondVotes) return b.secondVotes - a.secondVotes;
        return a.createdAt.getTime() - b.createdAt.getTime();
    });
    return scored.slice(0, take);
}

// --- Shared helper: post a battle announcement embed to a Discord channel via REST ---
async function postBattleAnnouncement(battle: any, settings: any): Promise<string | null> {
    const annChannelId = battle.announcementChannelId || settings?.announcementChannelId;
    if (!annChannelId) return 'No announcement channel configured. Set one in Beat Battle settings.';

    const apiUrl = process.env.API_URL || 'https://fujistud.io';
    let embed: any;

    if (battle.status === 'upcoming' || battle.status === 'active') {
        const fields: any[] = [];
        if (battle.submissionStart) {
            fields.push({ name: 'Submissions Open', value: `<t:${Math.floor(new Date(battle.submissionStart).getTime() / 1000)}:R>`, inline: true });
        }
        if (battle.submissionEnd) {
            fields.push({ name: 'Submissions Close', value: `<t:${Math.floor(new Date(battle.submissionEnd).getTime() / 1000)}:R>`, inline: true });
        }
        if (battle.rules) fields.push({ name: 'Rules', value: battle.rules });
        fields.push({ name: 'Submit & Vote', value: `[Enter on Fuji Studio](${apiUrl}/battles/${battle.id})` });
        embed = {
            title: `New Beat Battle: ${battle.title}`,
            description: battle.description || 'A new battle has begun! Submit your beats on the website.',
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
        fields.push({ name: 'Vote Now', value: `[Vote on Fuji Studio](${apiUrl}/battles/${battle.id})` });
        embed = {
            title: `${battle.title} - Voting is Now Open!`,
            description: 'Submissions are closed. Head to the website to listen and vote for your favourite beat!',
            color: 0xFFA500,
            fields,
            footer: { text: 'Fuji Studio Beat Battle' },
            timestamp: new Date().toISOString(),
        };
    } else if (battle.status === 'completed') {
        const winners = await rankedBattleEntries(battle.id, 3);
        if (!winners.length) return null;
        const medals = ['🥇', '🥈', '🥉'];
        const podiumLines = winners.map((w, i) =>
            `${medals[i] || '•'} <@${w.userId}> — **"${w.trackTitle}"** • **${w.points}** ${w.points === 1 ? 'pt' : 'pts'}`
        );
        const winnerMentions = winners.map(w => `<@${w.userId}>`).join(' ');
        embed = {
            title: `${battle.title} — Winners!`,
            description: `Congratulations ${winnerMentions}!\n\n${podiumLines.join('\n')}`,
            color: 0xFFD700,
            fields: [{ name: 'Listen', value: `[Play on Fuji Studio](${apiUrl}/battles/${battle.id})` }],
            footer: { text: 'Fuji Studio Beat Battle' },
            timestamp: new Date().toISOString(),
        };
        // Tag winners in the message body so they get notified.
        try {
            await discordReq('POST', `/channels/${annChannelId}/messages`, {
                content: winnerMentions,
                embeds: [embed],
                allowed_mentions: { users: winners.map(w => w.userId) },
            });
            return null;
        } catch (err: any) {
            const status = err.response?.status;
            if (status === 403) return `Bot lacks Send Messages permission in <#${annChannelId}>. Grant the bot "Send Messages" in that channel, then try again.`;
            if (status === 404) return `Announcement channel not found (ID: ${annChannelId}). Check the channel ID in Beat Battle settings.`;
            logger.error(`Beat Battle: failed to post announcement to channel ${annChannelId}: ${err.message}`);
            return 'Failed to post announcement (see server logs).';
        }
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin: Recompute podium for a completed battle (points-based) ---
// Used to fix battles that were finalized under the old vote-count logic.
// Body: { repostAnnouncement?: boolean } — when true, also re-posts the
// winner announcement to Discord with the new top 3.
app.post('/api/beat-battle/admin/battles/:id/recompute-winners', requireAdmin, async (req: any, res) => {
    try {
        const battle = await db.beatBattle.findUnique({ where: { id: req.params.id } });
        if (!battle) return res.status(404).json({ error: 'Battle not found' });
        if (battle.status !== 'completed') {
            return res.status(400).json({ error: 'Battle must be in "completed" status to recompute winners.' });
        }

        const ranked = await rankedBattleEntries(battle.id, 10);
        const newWinnerId = ranked[0]?.id || null;

        const updated = await db.beatBattle.update({
            where: { id: battle.id },
            data: { winnerEntryId: newWinnerId },
        });

        let announceError: string | null = null;
        if (req.body?.repostAnnouncement) {
            const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
            announceError = await postBattleAnnouncement(updated, settings);
        }

        await db.actionLog.create({
            data: {
                pluginId: 'beat-battle',
                guildId: battle.guildId,
                action: 'winners_recomputed',
                executorId: req.session.user.id,
                details: {
                    title: battle.title,
                    previousWinnerEntryId: battle.winnerEntryId,
                    newWinnerEntryId: newWinnerId,
                    podium: ranked.slice(0, 3).map(r => ({
                        entryId: r.id,
                        userId: r.userId,
                        trackTitle: r.trackTitle,
                        points: r.points,
                        first: r.firstVotes,
                        second: r.secondVotes,
                        third: r.thirdVotes,
                    })),
                },
            },
        }).catch(() => {});

        res.json({
            success: true,
            winnerEntryId: newWinnerId,
            podium: ranked.slice(0, 3),
            allEntries: ranked,
            announcementPosted: req.body?.repostAnnouncement ? !announceError : false,
            announceError,
        });
    } catch (e: any) {
        logger.error('Beat Battle: recompute winners failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin: CRUD Sponsors ---
// --- Public: Get battle page settings (featured battle, sponsor title) ---
app.get('/api/beat-battle/page-settings', publicCache(120), async (req: any, res) => {
    try {
        const guildId = (req.query.guildId as string) || 'default-guild';
        const settings = await db.beatBattleSettings.findFirst({ where: { guildId } });
        res.json({
            featuredBattleId: settings?.featuredBattleId || null,
            sponsorSectionTitle: settings?.sponsorSectionTitle || null,
        });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Public: Get sponsors shown on page ---
app.get('/api/beat-battle/sponsors', publicCache(300), async (req: any, res) => {
    try {
        const guildId = (req.query.guildId as string) || 'default-guild';
        const sponsors = await db.battleSponsor.findMany({
            where: { guildId, showOnPage: true, isActive: true },
            include: { links: true },
            orderBy: { createdAt: 'asc' },
        });
        res.json(sponsors);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/beat-battle/admin/sponsors', requireAdmin, async (req: any, res) => {
    try {
        const guildId = req.query.guildId as string | undefined;
        const sponsors = await db.battleSponsor.findMany({
            where: guildId ? { guildId } : undefined,
            include: { links: true, _count: { select: { battles: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(sponsors);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.patch('/api/beat-battle/admin/sponsors/:id', requireAdmin, async (req: any, res) => {
    try {
        const { name, logoUrl, websiteUrl, description, isActive, showOnPage, links } = req.body;
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (logoUrl !== undefined) data.logoUrl = logoUrl;
        if (websiteUrl !== undefined) data.websiteUrl = websiteUrl;
        if (description !== undefined) data.description = description;
        if (isActive !== undefined) data.isActive = isActive;
        if (showOnPage !== undefined) data.showOnPage = showOnPage;

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
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/beat-battle/admin/sponsors/:id', requireAdmin, async (req: any, res) => {
    try {
        await db.battleSponsor.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin: Upload sponsor logo ---
app.post('/api/beat-battle/admin/sponsors/:id/logo', requireAdmin, upload.single('sponsorLogo'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        // Magic byte validation
        try {
            FileValidator.validateImage(fs.readFileSync(req.file.path), req.file.originalname);
        } catch (validationErr: any) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }
        const localUrl = `/uploads/sponsors/${req.file.filename}`;
        const finalUrl = await uploadToR2OrLocal(
            req.file.path,
            `sponsors/${req.file.filename}`,
            req.file.mimetype,
            localUrl
        );
        await db.battleSponsor.update({
            where: { id: req.params.id },
            data: { logoUrl: finalUrl },
        });
        res.json({ url: finalUrl });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin: Upload battle banner image ---
// --- Admin: Upload prize image (no battle ID required) ---
app.post('/api/beat-battle/admin/prize-image', requireAdmin, upload.single('prizeImage'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        // Magic byte validation
        try {
            FileValidator.validateImage(fs.readFileSync(req.file.path), req.file.originalname);
        } catch (validationErr: any) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }
        const localUrl = `/uploads/battle-prizes/${req.file.filename}`;
        const finalUrl = await uploadToR2OrLocal(
            req.file.path,
            `battle-prizes/${req.file.filename}`,
            req.file.mimetype,
            localUrl
        );
        res.json({ url: finalUrl });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin: Upload rule audio sample (no battle ID required) ---
app.post('/api/beat-battle/admin/rule-sample', requireAdmin, upload.single('ruleSample'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        // Magic byte validation
        try {
            FileValidator.validateAudio(fs.readFileSync(req.file.path), req.file.originalname);
        } catch (validationErr: any) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }
        // Convert to OGG Opus for efficient web delivery
        const finalAudioPath = await MediaConverter.convertToOgg(req.file.path);
        const filename = path.basename(finalAudioPath);
        const localUrl = `/uploads/battle-rule-samples/${filename}`;
        const finalUrl = await uploadToR2OrLocal(
            finalAudioPath,
            `battle-rule-samples/${filename}`,
            'audio/ogg',
            localUrl
        );
        res.json({ url: finalUrl, name: req.file.originalname });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/beat-battle/admin/battles/:id/banner', requireAdmin, upload.single('battleBanner'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        // Magic byte validation
        try {
            FileValidator.validateImage(fs.readFileSync(req.file.path), req.file.originalname);
        } catch (validationErr: any) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }
        const localUrl = `/uploads/battle-banners/${req.file.filename}`;
        const finalUrl = await uploadToR2OrLocal(
            req.file.path,
            `battle-banners/${req.file.filename}`,
            req.file.mimetype,
            localUrl
        );
        await db.beatBattle.update({
            where: { id: req.params.id },
            data: { bannerUrl: finalUrl },
        });
        res.json({ url: finalUrl });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload battle card image (shown in homepage discovery card)
app.post('/api/beat-battle/admin/battles/:id/card-image', requireAdmin, upload.single('battleCardImage'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        // Magic byte validation
        try {
            FileValidator.validateImage(fs.readFileSync(req.file.path), req.file.originalname);
        } catch (validationErr: any) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }
        const localUrl = `/uploads/battle-banners/${req.file.filename}`;
        const finalUrl = await uploadToR2OrLocal(
            req.file.path,
            `battle-banners/${req.file.filename}`,
            req.file.mimetype,
            localUrl
        );
        await db.beatBattle.update({
            where: { id: req.params.id },
            data: { cardImageUrl: finalUrl },
        });
        res.json({ url: finalUrl });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Sponsor Analytics: Track website URL click ---
app.post('/api/beat-battle/sponsors/:sponsorId/click', async (req: any, res) => {
    try {
        const { page } = req.body || {};
        const ipHash = req.ip ? crypto.createHash('sha256').update(req.ip).digest('hex').slice(0, 16) : null;
        await Promise.all([
            db.battleSponsor.update({ where: { id: req.params.sponsorId }, data: { websiteClicks: { increment: 1 } } }),
            db.sponsorClick.create({ data: { sponsorId: req.params.sponsorId, linkId: null, userId: req.session?.user?.id || null, ipHash, page: page || null } }),
        ]);
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Sponsor Analytics: Track page view (impression) ---
app.post('/api/beat-battle/sponsors/:sponsorId/view', async (req: any, res) => {
    try {
        await db.battleSponsor.update({ where: { id: req.params.sponsorId }, data: { viewCount: { increment: 1 } } });
        res.json({ ok: true });
    } catch {
        res.json({ ok: true }); // silent fail — views are best-effort
    }
});

// --- Sponsor Analytics: Get detailed analytics (admin) ---
app.get('/api/beat-battle/admin/sponsors/:sponsorId/analytics', requireAdmin, async (req: any, res) => {
    try {
        const { sponsorId } = req.params;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [sponsor, recentClicks] = await Promise.all([
            db.battleSponsor.findUnique({
                where: { id: sponsorId },
                include: { links: { select: { id: true, label: true, clicks: true } } },
            }),
            db.sponsorClick.findMany({
                where: { sponsorId, createdAt: { gte: thirtyDaysAgo } },
                select: { id: true, ipHash: true, linkId: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
            }),
        ]);

        if (!sponsor) return res.status(404).json({ error: 'Not found' });

        // Total + unique clicks (all time from counter fields)
        const totalPromoClicks = sponsor.links.reduce((s: number, l: any) => s + l.clicks, 0);
        const totalWebClicks = (sponsor as any).websiteClicks || 0;
        const totalClicks = totalPromoClicks + totalWebClicks;

        // Unique clicks from recent 30-day log (distinct ipHash)
        const uniqueIps = new Set(recentClicks.map((c: any) => c.ipHash).filter(Boolean));
        const uniqueClicks30d = uniqueIps.size;

        // Daily click breakdown (last 30 days)
        const dailyMap: Record<string, number> = {};
        for (let i = 0; i < 30; i++) {
            const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
            dailyMap[d.toISOString().slice(0, 10)] = 0;
        }
        for (const c of recentClicks) {
            const day = c.createdAt.toISOString().slice(0, 10);
            if (dailyMap[day] !== undefined) dailyMap[day]++;
        }
        const dailyClicks = Object.entries(dailyMap).map(([date, clicks]) => ({ date, clicks }));

        res.json({
            totalClicks,
            totalWebClicks,
            totalPromoClicks,
            uniqueClicks30d,
            viewCount: (sponsor as any).viewCount || 0,
            promoLinks: sponsor.links,
            dailyClicks,
            clicks30d: recentClicks.length,
        });
    } catch (e: any) {
        logger.error('Sponsor analytics error', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Sponsor Analytics: Track promo link clicks ---
app.post('/api/beat-battle/sponsor-links/:linkId/click', async (req: any, res) => {
    try {
        const { page } = req.body || {};
        const ipHash = req.ip ? crypto.createHash('sha256').update(req.ip).digest('hex').slice(0, 16) : null;
        const link = await db.battleSponsorLink.update({
            where: { id: req.params.linkId },
            data: { clicks: { increment: 1 } },
        });
        // Log to SponsorClick for detailed analytics
        db.sponsorClick.create({ data: { sponsorId: link.sponsorId, linkId: link.id, userId: req.session?.user?.id || null, ipHash, page: page || null } }).catch(() => {});
        res.json({ clicks: link.clicks });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
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
                entries: { where: { deletedAt: null }, select: { id: true, voteCount: true, userId: true } },
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin: Per-battle vote breakdown (who voted for what) ---
app.get('/api/beat-battle/admin/battles/:id/votes', requireAdmin, async (req: any, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        const battleId = req.params.id;

        const battle = await db.beatBattle.findUnique({
            where: { id: battleId },
            select: {
                id: true, title: true,
                entries: {
                    where: { deletedAt: null },
                    select: {
                        id: true, userId: true, voteCount: true,
                        track: { select: { title: true, profile: { select: { username: true, displayName: true } } } },
                        votes: {
                            orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
                            select: { userId: true, rank: true, source: true, createdAt: true },
                        },
                    },
                },
            },
        });
        if (!battle) return res.status(404).json({ error: 'Battle not found' });

        // Resolve voter usernames in one query
        const voterIds = Array.from(new Set(battle.entries.flatMap(e => e.votes.map(v => v.userId))));
        const voterProfiles = voterIds.length
            ? await db.musicianProfile.findMany({
                where: { userId: { in: voterIds } },
                select: { userId: true, username: true, displayName: true, avatar: true },
            })
            : [];
        const profileMap = new Map(voterProfiles.map(p => [p.userId, p]));

        const RANK_POINTS = { 1: 3, 2: 2, 3: 1 } as const;

        const entries = battle.entries
            .map(entry => {
                const submitterProfile = entry.track?.profile;
                const votersByRank: Record<1 | 2 | 3, any[]> = { 1: [], 2: [], 3: [] };
                let pointTotal = 0;
                for (const v of entry.votes) {
                    if (v.rank !== 1 && v.rank !== 2 && v.rank !== 3) continue;
                    const p = profileMap.get(v.userId);
                    votersByRank[v.rank as 1 | 2 | 3].push({
                        userId: v.userId,
                        username: p?.username || p?.displayName || v.userId,
                        avatar: p?.avatar || null,
                        source: v.source,
                        createdAt: v.createdAt,
                    });
                    pointTotal += RANK_POINTS[v.rank as 1 | 2 | 3];
                }
                return {
                    entryId: entry.id,
                    submitterUserId: entry.userId,
                    submitterUsername: submitterProfile?.username || submitterProfile?.displayName || entry.userId,
                    trackTitle: entry.track?.title || 'Untitled',
                    voteCount: entry.voteCount,
                    pointTotal,
                    firstPlaceVotes: votersByRank[1],
                    secondPlaceVotes: votersByRank[2],
                    thirdPlaceVotes: votersByRank[3],
                };
            })
            .sort((a, b) => b.pointTotal - a.pointTotal);

        res.json({
            battleId: battle.id,
            battleTitle: battle.title,
            totalVotes: entries.reduce((s, e) => s + e.firstPlaceVotes.length + e.secondPlaceVotes.length + e.thirdPlaceVotes.length, 0),
            uniqueVoters: voterIds.length,
            entries,
        });
    } catch (e: any) {
        logger.error('Beat Battle API: admin votes failed', e);
        res.status(500).json({ error: 'Internal server error' });
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
                slug: (() => { const b = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); return `${b}-${Date.now()}`; })(),
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

            // Ensure a MusicianProfile exists for this winner (backfill creates a stub if missing)
            let profile = await db.musicianProfile.findUnique({ where: { userId: w.userId } });
            if (!profile) {
                const fallbackName = (w.username || `producer-${w.userId.slice(-6)}`)
                    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `producer-${w.userId.slice(-6)}`;
                profile = await db.musicianProfile.create({
                    data: {
                        userId: w.userId,
                        username: fallbackName,
                        displayName: w.username || null,
                    },
                });
            }

            // Create the Track that this entry will reference
            const track = await db.track.create({
                data: {
                    profileId: profile.id,
                    title: w.trackTitle,
                    url: w.audioUrl || '',
                    isPublic: true,
                },
            });

            const entry = await db.battleEntry.create({
                data: {
                    battleId: battle.id,
                    userId: w.userId,
                    trackId: track.id,
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
        res.status(500).json({ error: 'Internal server error' });
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
            announcementChannelId: null,
            chatChannelId: null,
            discordInviteUrl: null,
            featuredBattleId: null,
            sponsorSectionTitle: null,
            requireMusicianProfile: false,
            suddenDeathDurationMinutes: 60,
        });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/guilds/:guildId/beat-battle/settings', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'beat-battle') && !isTrueAdmin(guildId, req)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { announcementChannelId, chatChannelId, discordInviteUrl, featuredBattleId, sponsorSectionTitle, requireMusicianProfile,
                entryFeeEnabled, entryFee, prizePoolEnabled, prizeFirst, prizeSecond, prizeThird, voterReward,
                suddenDeathDurationMinutes } = req.body;

        const updateData: any = {
            announcementChannelId, chatChannelId, discordInviteUrl,
            featuredBattleId: featuredBattleId || null,
            sponsorSectionTitle: sponsorSectionTitle || null,
            requireMusicianProfile: requireMusicianProfile ?? false,
        };
        // Only set economy fields if provided
        if (entryFeeEnabled !== undefined) updateData.entryFeeEnabled = entryFeeEnabled;
        if (entryFee !== undefined) updateData.entryFee = parseInt(entryFee) || 0;
        if (prizePoolEnabled !== undefined) updateData.prizePoolEnabled = prizePoolEnabled;
        if (prizeFirst !== undefined) updateData.prizeFirst = parseInt(prizeFirst) || 0;
        if (prizeSecond !== undefined) updateData.prizeSecond = parseInt(prizeSecond) || 0;
        if (prizeThird !== undefined) updateData.prizeThird = parseInt(prizeThird) || 0;
        if (voterReward !== undefined) updateData.voterReward = parseInt(voterReward) || 0;
        if (suddenDeathDurationMinutes !== undefined) {
            const v = parseInt(suddenDeathDurationMinutes);
            updateData.suddenDeathDurationMinutes = Number.isFinite(v) && v > 0 ? v : 60;
        }

        const settings = await db.beatBattleSettings.upsert({
            where: { guildId },
            update: updateData,
            create: { guildId, ...updateData },
        });
        res.json(settings);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── robots.txt ───────────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send([
        'User-agent: *',
        'Allow: /',
        // Private / authenticated pages — no value to index
        'Disallow: /api/',
        'Disallow: /uploads/',
        'Disallow: /my-tracks',
        'Disallow: /my-playlists',
        'Disallow: /my-favourites',
        'Disallow: /feed',
        'Disallow: /account',
        'Disallow: /profile/edit',
        'Disallow: /profile/setup',
        'Disallow: /complete-account',
        'Disallow: /dashboard',
        '',
        `Sitemap: ${host}/sitemap-index.xml`,
    ].join('\n'));
});

// ─── Sitemap helpers ──────────────────────────────────────────────────────────

// Simple server-side cache so sitemap generation doesn't hammer the DB on every crawl
const sitemapCache = new Map<string, { xml: string; at: number }>();
const SITEMAP_TTL = 60 * 60 * 1000; // 1 hour

function xmlUrl(loc: string, opts?: { lastmod?: Date | string; changefreq?: string; priority?: string }): string {
    const parts = [`<url><loc>${escapeHtml(loc)}</loc>`];
    if (opts?.lastmod) {
        const d = opts.lastmod instanceof Date ? opts.lastmod : new Date(opts.lastmod);
        if (!isNaN(d.getTime())) parts.push(`<lastmod>${d.toISOString().split('T')[0]}</lastmod>`);
    }
    if (opts?.changefreq) parts.push(`<changefreq>${opts.changefreq}</changefreq>`);
    if (opts?.priority)   parts.push(`<priority>${opts.priority}</priority>`);
    parts.push('</url>');
    return parts.join('');
}

function buildSitemapXml(urls: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

// ─── Sitemap index ────────────────────────────────────────────────────────────
app.get('/sitemap-index.xml', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    const sitemaps = ['static', 'tracks', 'profiles', 'playlists', 'battles', 'genres', 'articles'];
    const today = new Date().toISOString().split('T')[0];
    const xml = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
        ...sitemaps.map(s => `<sitemap><loc>${host}/sitemap-${s}.xml</loc><lastmod>${today}</lastmod></sitemap>`),
        `</sitemapindex>`,
    ].join('\n');
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
});

// ─── Static pages sitemap ─────────────────────────────────────────────────────
app.get('/sitemap-static.xml', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    const pages = [
        { path: '/',         freq: 'daily',   pri: '1.0' },
        { path: '/battles',  freq: 'daily',   pri: '0.9' },
        { path: '/arena',    freq: 'hourly',  pri: '0.9' },
        { path: '/new',      freq: 'hourly',  pri: '0.8' },
        { path: '/artists',  freq: 'daily',   pri: '0.8' },
        { path: '/charts',   freq: 'daily',   pri: '0.8' },
        { path: '/genres',   freq: 'weekly',  pri: '0.7' },
        { path: '/library',  freq: 'daily',   pri: '0.7' },
        { path: '/learn',    freq: 'weekly',  pri: '0.7' },
        { path: '/feed',     freq: 'hourly',  pri: '0.6' },
        { path: '/appeal',   freq: 'monthly', pri: '0.4' },
        { path: '/terms',    freq: 'monthly', pri: '0.3' },
    ];
    const urls = pages.map(p => xmlUrl(`${host}${p.path}`, { changefreq: p.freq, priority: p.pri }));
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(buildSitemapXml(urls));
});

// ─── Track sitemap ────────────────────────────────────────────────────────────
app.get('/sitemap-tracks.xml', async (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    const cached = sitemapCache.get('tracks');
    if (cached && Date.now() - cached.at < SITEMAP_TTL) {
        return res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(cached.xml);
    }
    try {
        const tracks = await db.track.findMany({
            where: { isPublic: true, status: 'active', deletedAt: null },
            select: { slug: true, id: true, updatedAt: true, profile: { select: { username: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 40000,
        });
        const urls = tracks.map(t =>
            xmlUrl(`${host}/track/${t.profile.username}/${t.slug || t.id}`, { lastmod: t.updatedAt, changefreq: 'weekly', priority: '0.8' })
        );
        const xml = buildSitemapXml(urls);
        sitemapCache.set('tracks', { xml, at: Date.now() });
        res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
    } catch {
        res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    }
});

// ─── Profile sitemap ──────────────────────────────────────────────────────────
app.get('/sitemap-profiles.xml', async (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    const cached = sitemapCache.get('profiles');
    if (cached && Date.now() - cached.at < SITEMAP_TTL) {
        return res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(cached.xml);
    }
    try {
        const profiles = await db.musicianProfile.findMany({
            where: { status: 'active', deletedAt: null },
            select: { username: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: 20000,
        });
        const urls = profiles.map(p =>
            xmlUrl(`${host}/profile/${p.username}`, { lastmod: p.updatedAt, changefreq: 'weekly', priority: '0.7' })
        );
        const xml = buildSitemapXml(urls);
        sitemapCache.set('profiles', { xml, at: Date.now() });
        res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
    } catch {
        res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    }
});

// ─── Playlist sitemap ─────────────────────────────────────────────────────────
app.get('/sitemap-playlists.xml', async (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    const cached = sitemapCache.get('playlists');
    if (cached && Date.now() - cached.at < SITEMAP_TTL) {
        return res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(cached.xml);
    }
    try {
        const playlists = await db.playlist.findMany({
            where: { isPublic: true, deletedAt: null },
            select: { id: true, updatedAt: true, releaseType: true },
            orderBy: { updatedAt: 'desc' },
            take: 10000,
        });
        const urls = playlists.map(p =>
            xmlUrl(`${host}/playlist/${p.id}`, { lastmod: p.updatedAt, changefreq: 'weekly', priority: p.releaseType ? '0.8' : '0.6' })
        );
        const xml = buildSitemapXml(urls);
        sitemapCache.set('playlists', { xml, at: Date.now() });
        res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
    } catch {
        res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    }
});

// ─── Battle sitemap ───────────────────────────────────────────────────────────
app.get('/sitemap-battles.xml', async (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    const cached = sitemapCache.get('battles');
    if (cached && Date.now() - cached.at < SITEMAP_TTL) {
        return res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(cached.xml);
    }
    try {
        const [battles, entries] = await Promise.all([
            db.beatBattle.findMany({ select: { id: true, slug: true, updatedAt: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 5000 }),
            db.battleEntry.findMany({ where: { deletedAt: null }, select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20000 }),
        ]);
        const urls = [
            ...battles.map(b => xmlUrl(`${host}/battles/${b.slug || b.id}`, { lastmod: b.updatedAt, changefreq: b.status === 'completed' ? 'monthly' : 'hourly', priority: b.status === 'completed' ? '0.6' : '0.9' })),
            ...entries.map(e => xmlUrl(`${host}/battles/entry/${e.id}`, { lastmod: e.createdAt, changefreq: 'weekly', priority: '0.7' })),
        ];
        const xml = buildSitemapXml(urls);
        sitemapCache.set('battles', { xml, at: Date.now() });
        res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
    } catch {
        res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    }
});

// ─── Genre sitemap ────────────────────────────────────────────────────────────
app.get('/sitemap-genres.xml', async (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    const cached = sitemapCache.get('genres');
    if (cached && Date.now() - cached.at < SITEMAP_TTL) {
        return res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(cached.xml);
    }
    try {
        const genres = await db.genre.findMany({ select: { slug: true }, orderBy: { name: 'asc' } });
        const urls = genres.map(g => xmlUrl(`${host}/category/${g.slug}`, { changefreq: 'weekly', priority: '0.6' }));
        const xml = buildSitemapXml(urls);
        sitemapCache.set('genres', { xml, at: Date.now() });
        res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
    } catch {
        res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    }
});

// ─── Article sitemap ──────────────────────────────────────────────────────────
app.get('/sitemap-articles.xml', async (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    const cached = sitemapCache.get('articles');
    if (cached && Date.now() - cached.at < SITEMAP_TTL) {
        return res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(cached.xml);
    }
    try {
        const articles = await (db as any).article.findMany({
            where: { status: 'published' },
            select: { slug: true, updatedAt: true, publishedAt: true },
            orderBy: { publishedAt: 'desc' },
            take: 5000,
        });
        const urls = articles.map((a: any) =>
            xmlUrl(`${host}/article/${a.slug}`, { lastmod: a.updatedAt || a.publishedAt, changefreq: 'monthly', priority: '0.7' })
        );
        const xml = buildSitemapXml(urls);
        sitemapCache.set('articles', { xml, at: Date.now() });
        res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
    } catch {
        res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    }
});

// --- Serve Dashboard Dist in Production ---
const distPath = path.join(PROJECT_ROOT, 'dashboard/dist');
const indexHtml = path.join(distPath, 'index.html');

if (fs.existsSync(distPath)) {
    // 1. Hashed assets (/assets/*.js, /assets/*.css) \u2014 content-hashed filenames → cache 1 year
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
        index: false,
        setHeaders: (res) => {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
    }));

    // 2. Everything else (index.html, logo.svg, etc.) \u2014 no cache so the app shell always refreshes
    app.use((req, res, next) => {
        next();
    }, express.static(distPath, { index: false }));

    // 2. SPA Catch-all
    const BOT_UA = /discordbot|twitterbot|facebookexternalhit|slackbot|linkedinbot|whatsapp|telegrambot|redditbot|pinterest|googlebot|bingbot/i;
    const TRACK_PATH       = /^\/(profile|track)\/([^/?#]+)\/([^/?#]+)\/?$/;
    const PROFILE_PATH     = /^\/profile\/([^/?#]+)\/?$/;
    const BATTLE_ENTRY_PATH = /^\/battles\/entry\/([^/?#]+)\/?$/;
    const BATTLE_PATH      = /^\/battles\/([^/?#]+)\/?$/;
    const PLAYLIST_PATH    = /^\/playlist(?:s)?\/([^/?#]+)\/?$/;
    const ARTICLE_PATH     = /^\/article\/([^/?#]+)\/?$/;
    const CATEGORY_PATH    = /^\/(genres?|category)\/([^/?#]+)\/?$/;

    /** Build a complete HTML page with OG + Twitter/X + Discord meta tags + JSON-LD for bot crawlers */
    function ogPage(tags: Record<string, string>, extras: string[] = [], schema?: object): string {
        const safeTitle    = escapeHtml(tags.title || 'Fuji Studio');
        const safeDesc     = escapeHtml(tags.description || 'The home of FL Studio producers.');
        const safeImage    = tags.image || '';
        const safeImageAlt = escapeHtml(tags.imageAlt || tags.title || 'Fuji Studio');

        // Base JSON-LD: WebSite with SearchAction on every page
        const baseSchema = {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'WebSite',
                    '@id': 'https://fujistud.io/#website',
                    name: 'Fuji Studio',
                    url: 'https://fujistud.io',
                    description: 'The home of FL Studio producers. Discover beats, share tracks, and join beat battles.',
                    potentialAction: {
                        '@type': 'SearchAction',
                        target: { '@type': 'EntryPoint', urlTemplate: 'https://fujistud.io/artists?q={search_term_string}' },
                        'query-input': { '@type': 'PropertyValueSpecification', valueRequired: true, valueName: 'search_term_string' },
                    },
                },
                ...(schema ? [schema] : []),
            ],
        };

        const meta = [
            `<meta charset="utf-8" />`,
            `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
            `<title>${safeTitle}</title>`,
            `<meta name="description" content="${safeDesc}" />`,
            // Open Graph
            `<meta property="og:site_name" content="Fuji Studio" />`,
            `<meta property="og:type" content="${escapeHtml(tags.type || 'website')}" />`,
            `<meta property="og:title" content="${safeTitle}" />`,
            `<meta property="og:description" content="${safeDesc}" />`,
            tags.url   ? `<meta property="og:url" content="${escapeHtml(tags.url)}" />` : '',
            safeImage  ? `<meta property="og:image" content="${escapeHtml(safeImage)}" />` : '',
            safeImage  ? `<meta property="og:image:secure_url" content="${escapeHtml(safeImage)}" />` : '',
            safeImage  ? `<meta property="og:image:alt" content="${safeImageAlt}" />` : '',
            tags.imageWidth  ? `<meta property="og:image:width" content="${escapeHtml(tags.imageWidth)}" />` : '',
            tags.imageHeight ? `<meta property="og:image:height" content="${escapeHtml(tags.imageHeight)}" />` : '',
            // Twitter / X
            `<meta name="twitter:card" content="summary_large_image" />`,
            `<meta name="twitter:site" content="@fujistudio" />`,
            `<meta name="twitter:title" content="${safeTitle}" />`,
            `<meta name="twitter:description" content="${safeDesc}" />`,
            safeImage  ? `<meta name="twitter:image" content="${escapeHtml(safeImage)}" />` : '',
            safeImage  ? `<meta name="twitter:image:alt" content="${safeImageAlt}" />` : '',
            // Theme & canonical
            `<meta name="theme-color" content="#2B8C71" />`,
            tags.url ? `<link rel="canonical" href="${escapeHtml(tags.url)}" />` : '',
            ...extras,
            // JSON-LD
            `<script type="application/ld+json">${JSON.stringify(baseSchema)}</script>`,
        ].filter(Boolean).join('\n');

        return `<!DOCTYPE html><html lang="en"><head>\n${meta}\n<meta http-equiv="refresh" content="0;url=${escapeHtml(tags.url || '/')}"></head><body></body></html>`;
    }

    app.get('*', async (req: any, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();

        const ua = req.headers['user-agent'] || '';
        const isBot = BOT_UA.test(ua);

        if (isBot) {
            logger.info(`[OG] Bot crawl: path=${req.path} ua="${ua.slice(0, 80)}"`);
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const toAbsolute = (u: string | null | undefined): string | null =>
                u ? (u.startsWith('http') ? u : `${baseUrl}${u}`) : null;
            const defaultImage = `${baseUrl}/og-default.png`;

            try {
                // ── Track page: /profile/:username/:slug  or  /track/:username/:slug ──
                const trackMatch = req.path.match(TRACK_PATH);
                if (trackMatch) {
                    const [, , username, slug] = trackMatch;
                    const profile = await db.musicianProfile.findFirst({
                        where: { username: { equals: username, mode: 'insensitive' } },
                    });
                    if (profile) {
                        let track: any = await db.track.findFirst({
                            where: { profileId: profile.id, isPublic: true, slug: { equals: slug, mode: 'insensitive' } },
                            include: { profile: true, genres: { include: { genre: true } } },
                        });
                        if (!track) {
                            track = await db.track.findFirst({
                                where: { profileId: profile.id, isPublic: true, id: slug },
                                include: { profile: true, genres: { include: { genre: true } } },
                            });
                        }
                        if (track) {
                            const trackUrl  = `${baseUrl}/track/${username}/${track.slug || slug}`;
                            const imageUrl  = toAbsolute(track.coverUrl) ?? defaultImage;
                            const audioUrl  = toAbsolute(track.url);
                            const artistName: string = track.profile.displayName || track.profile.username || username;
                            const genreNames: string[] = (track.genres ?? []).map((g: any) => g.genre?.name).filter(Boolean);
                            const parts = [`By ${artistName}`];
                            if (genreNames.length) parts.push(genreNames.join(', '));
                            if (track.bpm)  parts.push(`${track.bpm} BPM`);
                            if (track.key)  parts.push(track.key);
                            if (track.duration) {
                                const m = Math.floor(track.duration / 60), s = track.duration % 60;
                                parts.push(`${m}:${String(s).padStart(2, '0')}`);
                            }
                            if (typeof track.playCount === 'number') parts.push(`${track.playCount.toLocaleString()} plays`);
                            const metaLine = parts.join(' · ');
                            const bodyText = track.description ? track.description.slice(0, 120) : '';
                            const description = bodyText ? `${metaLine}\n${bodyText}` : metaLine;
                            const oembedUrl = `${baseUrl}/api/oembed?url=${encodeURIComponent(trackUrl)}&format=json`;
                            const typeLabel = track.trackType === 'remix' ? 'Remix' : track.trackType === 'cover' ? 'Cover' : 'Track';
                            const trackSchema = {
                                '@type': 'MusicRecording',
                                '@id': `${trackUrl}#track`,
                                name: track.title,
                                byArtist: { '@type': 'MusicGroup', name: artistName, url: `${baseUrl}/profile/${username}` },
                                url: trackUrl,
                                image: imageUrl,
                                ...(track.duration ? { duration: `PT${Math.floor(track.duration / 60)}M${track.duration % 60}S` } : {}),
                                ...(genreNames.length ? { genre: genreNames } : {}),
                                ...(track.bpm ? { additionalProperty: { '@type': 'PropertyValue', name: 'BPM', value: track.bpm } } : {}),
                                interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/ListenAction', userInteractionCount: track.playCount ?? 0 },
                            };
                            return res.send(ogPage(
                                { title: `${track.title} — ${typeLabel} by ${artistName} | Fuji Studio`, description, type: 'music.song', url: trackUrl, image: imageUrl, imageAlt: `Cover art for ${track.title}`, imageWidth: '500', imageHeight: '500' },
                                [
                                    audioUrl ? `<meta property="og:audio" content="${escapeHtml(audioUrl)}">` : '',
                                    audioUrl ? `<meta property="og:audio:secure_url" content="${escapeHtml(audioUrl)}">` : '',
                                    audioUrl ? `<meta property="og:audio:type" content="audio/ogg">` : '',
                                    `<meta property="music:musician" content="${baseUrl}/profile/${username}">`,
                                    `<link rel="alternate" type="application/json+oembed" href="${oembedUrl}" title="${escapeHtml(track.title)}">`,
                                ].filter(Boolean),
                                trackSchema,
                            ));
                        }
                    }
                }

                // ── Profile page: /profile/:username ──
                const profileMatch = req.path.match(PROFILE_PATH);
                if (profileMatch && !req.path.match(TRACK_PATH)) {
                    const [, username] = profileMatch;
                    const profile: any = await db.musicianProfile.findFirst({
                        where: { username: { equals: username, mode: 'insensitive' } },
                        include: {
                            _count: { select: { tracks: { where: { isPublic: true, status: 'active' } }, followers: true } },
                            primaryGenre: { select: { name: true } },
                        },
                    });
                    if (profile) {
                        const displayName = profile.displayName || profile.username;
                        const trackCount  = profile._count?.tracks ?? 0;
                        const followers   = profile._count?.followers ?? 0;
                        const parts: string[] = [];
                        if (profile.bio) parts.push(profile.bio.slice(0, 120));
                        const stats: string[] = [];
                        if (trackCount > 0)  stats.push(`${trackCount} track${trackCount === 1 ? '' : 's'}`);
                        if (followers > 0)   stats.push(`${followers} follower${followers === 1 ? '' : 's'}`);
                        if (profile.primaryGenre?.name) stats.push(profile.primaryGenre.name);
                        if (profile.location) stats.push(profile.location);
                        if (stats.length) parts.push(stats.join(' · '));
                        const description = parts.join('\n') || 'Artist on Fuji Studio';
                        const image = toAbsolute(profile.bannerUrl || profile.avatar) ?? defaultImage;
                        const profileSchema = {
                            '@type': 'MusicGroup',
                            '@id': `${baseUrl}/profile/${username}#artist`,
                            name: displayName,
                            url: `${baseUrl}/profile/${username}`,
                            ...(profile.avatar ? { image: toAbsolute(profile.avatar) } : {}),
                            ...(profile.bio ? { description: profile.bio.slice(0, 200) } : {}),
                            ...(profile.location ? { location: { '@type': 'Place', name: profile.location } } : {}),
                            interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/FollowAction', userInteractionCount: profile._count?.followers ?? 0 },
                        };
                        return res.send(ogPage({
                            title: `${displayName} | Fuji Studio`,
                            description,
                            type: 'profile',
                            url: `${baseUrl}/profile/${username}`,
                            image,
                            imageAlt: `${displayName}'s profile on Fuji Studio`,
                        }, [
                            `<meta property="profile:username" content="${escapeHtml(username)}">`,
                        ], profileSchema));
                    }
                }

                // ── Battle entry: /battles/entry/:id ── (must come before BATTLE_PATH)
                const entryMatch = req.path.match(BATTLE_ENTRY_PATH);
                if (entryMatch) {
                    const [, entryId] = entryMatch;
                    const entry: any = await db.battleEntry.findUnique({
                        where: { id: entryId },
                        include: { battle: { select: { title: true, slug: true } } },
                    });
                    if (entry) {
                        const image = toAbsolute(entry.coverUrl) ?? defaultImage;
                        const votes = entry.voteCount ?? 0;
                        const rank = entry.rank ? `Ranked #${entry.rank}` : null;
                        const parts = [`${votes} vote${votes === 1 ? '' : 's'} · ${entry.battle.title}`];
                        if (rank) parts.push(rank);
                        return res.send(ogPage({
                            title: `${entry.trackTitle} by ${entry.username} | Beat Battle | Fuji Studio`,
                            description: parts.join(' · '),
                            url: `${baseUrl}/battles/entry/${entryId}`,
                            image,
                            imageAlt: `Cover art for ${entry.trackTitle}`,
                            imageWidth: '500', imageHeight: '500',
                        }));
                    }
                }

                // ── Battle detail: /battles/:idOrSlug ──
                const battleMatch = req.path.match(BATTLE_PATH);
                if (battleMatch) {
                    const [, idOrSlug] = battleMatch;
                    const battle: any = await db.beatBattle.findFirst({
                        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
                        include: {
                            _count: { select: { entries: { where: { deletedAt: null } } } },
                            entries: { where: { deletedAt: null }, orderBy: [{ voteCount: 'desc' }], take: 3, select: { username: true, voteCount: true } },
                        },
                    });
                    if (battle) {
                        const statusLabel: Record<string, string> = { upcoming: '🔜 Upcoming', active: '🎤 Submissions Open', voting: '🗳️ Voting Live', completed: '🏆 Completed' };
                        const entryCount = battle._count?.entries ?? 0;
                        const topNames   = battle.entries?.map((e: any) => e.username).filter(Boolean).join(', ');
                        const prize      = battle.prizePool ? `🏅 Prize: ${battle.prizePool}` : null;
                        const parts: string[] = [statusLabel[battle.status] || battle.status];
                        if (entryCount > 0) parts.push(`${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`);
                        if (topNames) parts.push(`Featuring ${topNames}`);
                        if (prize) parts.push(prize);
                        if (battle.description) parts.push(battle.description.slice(0, 100));
                        const image = toAbsolute(battle.bannerUrl || battle.cardImageUrl) ?? defaultImage;
                        const battleSchema: any = {
                            '@type': 'Event',
                            '@id': `${baseUrl}/battles/${idOrSlug}#event`,
                            name: battle.title,
                            url: `${baseUrl}/battles/${idOrSlug}`,
                            description: parts.join(' · '),
                            image,
                            organizer: { '@type': 'Organization', name: 'Fuji Studio', url: baseUrl },
                            eventStatus: battle.status === 'completed' ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventScheduled',
                        };
                        if (battle.submissionStart) battleSchema.startDate = new Date(battle.submissionStart).toISOString();
                        if (battle.votingEnd)        battleSchema.endDate   = new Date(battle.votingEnd).toISOString();
                        return res.send(ogPage({
                            title: `${battle.title} | Beat Battle | Fuji Studio`,
                            description: parts.join(' · '),
                            url: `${baseUrl}/battles/${idOrSlug}`,
                            image,
                            imageAlt: `${battle.title} beat battle banner`,
                        }, [], battleSchema));
                    }
                }

                // ── Playlist: /playlist/:id  or  /playlists/:id ──
                const playlistMatch = req.path.match(PLAYLIST_PATH);
                if (playlistMatch) {
                    const [, playlistId] = playlistMatch;
                    const playlist: any = await db.playlist.findUnique({
                        where: { id: playlistId },
                        include: { _count: { select: { tracks: true } }, profile: { select: { username: true, displayName: true } } },
                    });
                    if (playlist) {
                        const trackCount = playlist._count?.tracks ?? 0;
                        const creator    = playlist.profile?.displayName || playlist.profile?.username;
                        const typeLabel  = playlist.releaseType ? playlist.releaseType.charAt(0).toUpperCase() + playlist.releaseType.slice(1) : 'Playlist';
                        const parts: string[] = [];
                        if (creator) parts.push(`By ${creator}`);
                        parts.push(`${trackCount} track${trackCount === 1 ? '' : 's'}`);
                        if (playlist.description) parts.push(playlist.description.slice(0, 100));
                        const image = toAbsolute(playlist.coverUrl) ?? defaultImage;
                        const playlistSchema = {
                            '@type': playlist.releaseType ? 'MusicAlbum' : 'MusicPlaylist',
                            '@id': `${baseUrl}/playlist/${playlistId}#playlist`,
                            name: playlist.name,
                            url: `${baseUrl}/playlist/${playlistId}`,
                            ...(image !== defaultImage ? { image } : {}),
                            ...(playlist.description ? { description: playlist.description.slice(0, 200) } : {}),
                            numTracks: trackCount,
                            ...(creator ? { byArtist: { '@type': 'MusicGroup', name: creator } } : {}),
                        };
                        return res.send(ogPage({
                            title: `${playlist.name} | ${typeLabel} | Fuji Studio`,
                            description: parts.join(' · '),
                            url: `${baseUrl}/playlist/${playlistId}`,
                            image,
                            imageAlt: `Cover for ${playlist.name}`,
                        }, [
                            `<meta property="music:song_count" content="${trackCount}">`,
                        ], playlistSchema));
                    }
                }

                // ── Genre/Category: /genres/:slug  or  /category/:slug ──
                const categoryMatch = req.path.match(CATEGORY_PATH);
                if (categoryMatch) {
                    const [, , slug] = categoryMatch;
                    const genre: any = await db.genre.findFirst({
                        where: { OR: [{ slug: { equals: slug, mode: 'insensitive' } }, { name: { equals: slug.replace(/-/g, ' '), mode: 'insensitive' } }] },
                        include: { _count: { select: { tracks: true, profiles: true } } },
                    });
                    if (genre) {
                        const trackCount  = genre._count?.tracks ?? 0;
                        const artistCount = genre._count?.profiles ?? 0;
                        const parts: string[] = [`${trackCount} track${trackCount === 1 ? '' : 's'}`];
                        if (artistCount > 0) parts.push(`${artistCount} artist${artistCount === 1 ? '' : 's'}`);
                        return res.send(ogPage({
                            title: `${genre.name} Music | Fuji Studio`,
                            description: `Browse ${genre.name} beats and tracks on Fuji Studio. ${parts.join(' · ')}.`,
                            url: `${baseUrl}/category/${slug}`,
                            image: defaultImage,
                        }));
                    }
                }

                // ── Article: /article/:slug ──
                const articleMatch = req.path.match(ARTICLE_PATH);
                if (articleMatch) {
                    const [, slug] = articleMatch;
                    const article: any = await (db as any).article?.findFirst?.({ where: { slug, status: 'published' } });
                    if (article) {
                        const title = article.metaTitle || article.title || 'Article';
                        const desc  = article.metaDescription || article.excerpt || article.content?.slice(0, 160) || '';
                        const image = toAbsolute(article.coverImageUrl) ?? defaultImage;
                        const extras: string[] = [];
                        if (article.publishedAt) extras.push(`<meta property="article:published_time" content="${new Date(article.publishedAt).toISOString()}">`);
                        if (article.updatedAt)   extras.push(`<meta property="article:modified_time" content="${new Date(article.updatedAt).toISOString()}">`);
                        return res.send(ogPage({ title: `${title} | Fuji Studio`, description: desc, type: 'article', url: `${baseUrl}/article/${slug}`, image, imageAlt: title }, extras));
                    }
                }

                // ── Dynamic static pages — fetch live data for richer descriptions ──
                const dynamicPages: Record<string, () => Promise<{ title: string; description: string } | null>> = {
                    '/': async () => {
                        const [trackCount, artistCount] = await Promise.all([
                            db.track.count({ where: { isPublic: true, status: 'active', deletedAt: null } }),
                            db.musicianProfile.count({ where: { status: 'active', deletedAt: null } }),
                        ]);
                        return { title: 'Fuji Studio | Discover Music', description: `Discover beats, share your music, and connect with FL Studio producers. ${artistCount.toLocaleString()} artists · ${trackCount.toLocaleString()} tracks and counting.` };
                    },
                    '/battles': async () => {
                        const active = await db.beatBattle.findFirst({ where: { status: { in: ['active', 'voting'] } }, orderBy: { createdAt: 'desc' } }) as any;
                        if (active) return { title: `${active.title} | Beat Battles | Fuji Studio`, description: `${active.status === 'voting' ? '🗳️ Voting is live!' : '🎤 Submissions are open!'} Compete, vote, and win on Fuji Studio Beat Battles.` };
                        return { title: 'Beat Battles | Fuji Studio', description: 'Compete in beat battles, vote for your favourite tracks, and win prizes on Fuji Studio.' };
                    },
                    '/arena': async () => {
                        const [activeMatches, topPlayer] = await Promise.all([
                            (db as any).h2HMatch.count({ where: { status: { in: ['producing', 'voting', 'ready_check'] } } }),
                            (db as any).h2HRating?.findFirst?.({ orderBy: { elo: 'desc' }, include: { profile: { select: { displayName: true, username: true } } } }),
                        ]).catch(() => [0, null]);
                        const topName = (topPlayer as any)?.profile?.displayName || (topPlayer as any)?.profile?.username;
                        const parts = ['Producer vs producer. Get a sample pack, produce a beat, let the community vote.'];
                        if (activeMatches > 0) parts.push(`${activeMatches} live match${activeMatches === 1 ? '' : 'es'} right now.`);
                        if (topName) parts.push(`Top-ranked: ${topName}`);
                        return { title: '1v1 Arena | Fuji Studio', description: parts.join(' ') };
                    },
                    '/new': async () => {
                        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                        const [recent, newest] = await Promise.all([
                            db.track.count({ where: { isPublic: true, status: 'active', createdAt: { gte: since } } }),
                            db.track.findFirst({ where: { isPublic: true, status: 'active' }, orderBy: { createdAt: 'desc' }, include: { profile: { select: { displayName: true, username: true } } } }) as any,
                        ]);
                        const artist = (newest as any)?.profile?.displayName || (newest as any)?.profile?.username;
                        const parts = [`${recent} new track${recent === 1 ? '' : 's'} this week.`];
                        if (artist && newest) parts.push(`Latest: "${(newest as any).title}" by ${artist}`);
                        return { title: 'Latest Releases | Fuji Studio', description: parts.join(' ') };
                    },
                    '/artists': async () => {
                        const top = await db.musicianProfile.findMany({ where: { status: 'active', deletedAt: null }, orderBy: { totalPlays: 'desc' }, take: 3, select: { displayName: true, username: true } });
                        const names = top.map((p: any) => p.displayName || p.username).join(', ');
                        return { title: 'Artists | Fuji Studio', description: `Discover talented FL Studio producers on Fuji Studio.${names ? ` Featuring ${names} and more.` : ''}` };
                    },
                    '/charts': async () => {
                        const top = await db.track.findMany({ where: { isPublic: true, status: 'active' }, orderBy: { playCount: 'desc' }, take: 3, include: { profile: { select: { displayName: true, username: true } } } }) as any[];
                        const names = top.map((t: any) => `"${t.title}" by ${t.profile?.displayName || t.profile?.username}`).join(', ');
                        return { title: 'Charts | Fuji Studio', description: `The most-played tracks on Fuji Studio.${names ? ` Top: ${names}.` : ''}` };
                    },
                    '/genres': async () => {
                        const genres = await db.genre.findMany({ where: { parentId: null }, take: 6, select: { name: true } });
                        const names = genres.map((g: any) => g.name).join(', ');
                        return { title: 'Genres | Fuji Studio', description: `Browse music by genre on Fuji Studio.${names ? ` Including ${names} and more.` : ''}` };
                    },
                    '/library': async () => ({ title: 'Music Library | Fuji Studio', description: 'Browse and stream tracks from the Fuji Studio producer community.' }),
                    '/learn':   async () => ({ title: 'Fuji Academy | Fuji Studio', description: 'Learn FL Studio interactively with hands-on lessons in a built-in DAW simulator. Free for all members.' }),
                    '/feed':    async () => ({ title: 'Feed | Fuji Studio', description: 'The latest tracks, reposts, and activity from artists you follow on Fuji Studio.' }),
                    '/appeal':  async () => ({ title: 'Support & Appeals | Fuji Studio', description: 'Appeal a moderation action or get help from the Fuji Studio team.' }),
                    '/login':   async () => ({ title: 'Sign In | Fuji Studio', description: 'Sign in to Fuji Studio to upload tracks, join beat battles, and connect with producers.' }),
                    '/register': async () => ({ title: 'Join Fuji Studio', description: 'Create your free Fuji Studio account and start sharing your beats with the community.' }),
                };

                if (dynamicPages[req.path]) {
                    const data = await dynamicPages[req.path]().catch(() => null);
                    if (data) {
                        const dbEmbed = await db.pageEmbed.findUnique({ where: { path: req.path } });
                        const img = toAbsolute(dbEmbed?.imageUrl) ?? defaultImage;
                        const title = dbEmbed?.title || data.title;
                        const description = dbEmbed?.description || data.description;
                        // Homepage gets an Organization schema
                        const homeSchema = req.path === '/' ? {
                            '@type': 'Organization',
                            '@id': `${baseUrl}/#organization`,
                            name: 'Fuji Studio',
                            url: baseUrl,
                            logo: { '@type': 'ImageObject', url: `${baseUrl}/logo.svg` },
                            sameAs: ['https://discord.gg/fujistudio'],
                        } : undefined;
                        return res.send(ogPage({ title, description, url: `${baseUrl}${req.path}`, image: img }, [], homeSchema));
                    }
                }

                // ── DB-editable embed override for any other path ──
                const dbEmbed = await db.pageEmbed.findUnique({ where: { path: req.path } });
                if (dbEmbed) {
                    const img = toAbsolute(dbEmbed.imageUrl) ?? defaultImage;
                    return res.send(ogPage({ title: dbEmbed.title, description: dbEmbed.description, url: `${baseUrl}${req.path}`, image: img }));
                }

                // ── Fallback ──
                return res.send(ogPage({ title: 'Fuji Studio', description: 'The home of FL Studio producers. Discover beats, share tracks, and join beat battles.', url: `${baseUrl}${req.path}`, image: defaultImage }));

            } catch (err: any) {
                logger.warn(`[SPA bot-detect] error: ${err.message}`);
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
                await db.beatBattle.update({ where: { id: battle.id }, data: { status: 'active' } });
                const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
                await postBattleAnnouncement({ ...battle, status: 'active' }, settings);
            } catch (err: any) {
                logger.error(`Beat Battle lifecycle: failed to activate "${battle.title}": ${err.message}`);
            }
        }

        // ---------- 2. Active → Voting (submissionEnd passed) ----------
        const toVoting = await db.beatBattle.findMany({
            where: { status: 'active', submissionEnd: { not: null, lte: now } },
        });
        if (toVoting.length) logger.info(`Beat Battle lifecycle: ${toVoting.length} battle(s) moving to voting`);

        for (const battle of toVoting) {
            try {
                logger.info(`Beat Battle lifecycle: "${battle.title}" → voting`);
                await db.beatBattle.update({ where: { id: battle.id }, data: { status: 'voting' } });
                const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
                await postBattleAnnouncement({ ...battle, status: 'voting' }, settings);
            } catch (err: any) {
                logger.error(`Beat Battle lifecycle: failed to transition "${battle.title}" to voting: ${err.message}`);
            }
        }

        // ---------- 3. Voting -> Completed OR Sudden Death (votingEnd passed) ----------
        const toComplete = await db.beatBattle.findMany({
            where: { status: 'voting', votingEnd: { not: null, lte: now } },
        });
        if (toComplete.length) logger.info(`Beat Battle lifecycle: ${toComplete.length} battle(s) finishing voting`);

        for (const battle of toComplete) {
            try {
                const result = await resolveBattleRanking(battle.id);
                if (result.tied.length > 1) {
                    const durationMin = (battle as any).suddenDeathDurationMinutes || 60;
                    const start = new Date();
                    const end = new Date(start.getTime() + durationMin * 60_000);
                    logger.info(`Beat Battle lifecycle: "${battle.title}" -> sudden_death (${result.tied.length} entries, ${durationMin}min)`);
                    await db.beatBattle.update({
                        where: { id: battle.id },
                        data: {
                            status: 'sudden_death',
                            suddenDeathStart: start,
                            suddenDeathEnd: end,
                            suddenDeathEntryIds: result.tied,
                        },
                    });
                    const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
                    await postBattleAnnouncement({ ...battle, status: 'sudden_death' }, settings);
                } else {
                    const winnerId = result.winnerEntryId;
                    logger.info(`Beat Battle lifecycle: completing "${battle.title}" (winner: ${winnerId || 'none'})`);
                    await db.beatBattle.update({
                        where: { id: battle.id },
                        data: { status: 'completed', winnerEntryId: winnerId },
                    });
                    const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
                    await postBattleAnnouncement({ ...battle, status: 'completed', winnerEntryId: winnerId }, settings);
                }
            } catch (err: any) {
                logger.error(`Beat Battle lifecycle: failed to complete "${battle.title}": ${err.message}`);
            }
        }

        // ---------- 4. Sudden Death -> Completed (suddenDeathEnd passed) ----------
        const sdToComplete = await db.beatBattle.findMany({
            where: { status: 'sudden_death', suddenDeathEnd: { not: null, lte: now } },
        });
        for (const battle of sdToComplete) {
            try {
                const tied: string[] = Array.isArray((battle as any).suddenDeathEntryIds) ? (battle as any).suddenDeathEntryIds : [];
                let winnerId: string | null = null;
                if (tied.length > 0) {
                    const sdVotes = await db.battleVote.groupBy({
                        by: ['entryId'],
                        where: {
                            battleId: battle.id,
                            entryId: { in: tied },
                            createdAt: { gte: (battle as any).suddenDeathStart || new Date(0) },
                        },
                        _count: { _all: true },
                    });
                    const sorted = (sdVotes as any[]).map(v => ({ id: v.entryId, count: v._count._all }))
                        .sort((a, b) => b.count - a.count);
                    if (sorted.length > 0 && (sorted.length === 1 || sorted[0].count > sorted[1].count)) {
                        winnerId = sorted[0].id;
                    } else {
                        // Still tied after sudden death -> earliest entry wins
                        const stillTied = sorted.length > 0
                            ? sorted.filter(s => s.count === sorted[0].count).map(s => s.id)
                            : tied;
                        const fallback = await db.battleEntry.findFirst({
                            where: { id: { in: stillTied } },
                            orderBy: { createdAt: 'asc' },
                            select: { id: true },
                        });
                        winnerId = fallback?.id || stillTied[0] || null;
                    }
                }
                logger.info(`Beat Battle lifecycle: completing sudden death for "${battle.title}" (winner: ${winnerId || 'none'})`);
                await db.beatBattle.update({
                    where: { id: battle.id },
                    data: { status: 'completed', winnerEntryId: winnerId },
                });
                const settings = await db.beatBattleSettings.findUnique({ where: { guildId: battle.guildId } });
                await postBattleAnnouncement({ ...battle, status: 'completed', winnerEntryId: winnerId }, settings);
            } catch (err: any) {
                logger.error(`Beat Battle lifecycle: failed sudden-death completion for "${battle.title}": ${err.message}`);
            }
        }
    } catch (err: any) {
        logger.error(`Beat Battle lifecycle error: ${err.message}`);
    }
}

// Lexicographical Positional Scoring: compare 1st-place counts, then 2nd, then 3rd.
// Returns either a unique winnerEntryId or the set of tied entry IDs (>1 means sudden death).
async function resolveBattleRanking(battleId: string): Promise<{ winnerEntryId: string | null; tied: string[] }> {
    const entries = await db.battleEntry.findMany({
        where: { battleId, deletedAt: null },
        select: { id: true, createdAt: true },
    });
    if (entries.length === 0) return { winnerEntryId: null, tied: [] };
    if (entries.length === 1) return { winnerEntryId: entries[0].id, tied: [] };

    const tallies = await db.battleVote.groupBy({
        by: ['entryId', 'rank'],
        where: { battleId },
        _count: { _all: true },
    });
    const map = new Map<string, [number, number, number]>();
    for (const e of entries) map.set(e.id, [0, 0, 0]);
    for (const t of tallies as any[]) {
        const arr = map.get(t.entryId);
        if (!arr) continue;
        if (t.rank === 1) arr[0] = t._count._all;
        else if (t.rank === 2) arr[1] = t._count._all;
        else if (t.rank === 3) arr[2] = t._count._all;
    }
    const sorted = entries.map(e => ({ id: e.id, score: map.get(e.id)! }))
        .sort((a, b) => (b.score[0] - a.score[0]) || (b.score[1] - a.score[1]) || (b.score[2] - a.score[2]));
    const top = sorted[0];
    const tied = sorted.filter(s =>
        s.score[0] === top.score[0] &&
        s.score[1] === top.score[1] &&
        s.score[2] === top.score[2]
    ).map(s => s.id);
    if (tied.length > 1 && top.score[0] === 0 && top.score[1] === 0 && top.score[2] === 0) {
        const earliest = entries.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        return { winnerEntryId: earliest.id, tied: [] };
    }
    if (tied.length === 1) return { winnerEntryId: tied[0], tied: [] };
    return { winnerEntryId: null, tied };
}

// Run lifecycle immediately on start, then every 60 seconds
runBeatBattleLifecycle();
setInterval(runBeatBattleLifecycle, 60_000);

// ----------------------------------------------------------------------------
// Head-to-Head 1v1 Producer Battles
// ----------------------------------------------------------------------------

const PUBLIC_GUILD_ID_H2H = 'default-guild';

const h2hUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB cap on submissions/samples
});

async function getH2HSettings(): Promise<any> {
    let s = await db.headToHeadSettings.findUnique({ where: { guildId: PUBLIC_GUILD_ID_H2H } });
    if (!s) {
        await db.guild.upsert({
            where: { id: PUBLIC_GUILD_ID_H2H },
            create: { id: PUBLIC_GUILD_ID_H2H, name: 'Default Guild' },
            update: {},
        });
        s = await db.headToHeadSettings.create({ data: { guildId: PUBLIC_GUILD_ID_H2H } });
    }
    return s;
}

async function getOrCreateRating(userId: string, genreId: string | null): Promise<any> {
    const settings = await getH2HSettings();
    const existing = await db.h2HRating.findFirst({ where: { userId, genreId: genreId ?? null } });
    if (existing) return existing;
    return db.h2HRating.create({
        data: { userId, genreId: genreId ?? null, elo: settings.startingElo },
    });
}

function calcEloDelta(winnerElo: number, loserElo: number, kFactor: number): { winnerDelta: number; loserDelta: number } {
    const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const expectedLoser = 1 - expectedWinner;
    const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
    const loserDelta = Math.round(kFactor * (0 - expectedLoser));
    return { winnerDelta, loserDelta };
}

async function applyEloUpdate(match: any, winnerId: string, loserId: string): Promise<{ before: any; after: any }> {
    const settings = await getH2HSettings();
    const k = settings.kFactor || 32;
    const genreId = match.genreId ?? null;

    const [winnerGlobal, loserGlobal, winnerGenre, loserGenre] = await Promise.all([
        getOrCreateRating(winnerId, null),
        getOrCreateRating(loserId, null),
        genreId ? getOrCreateRating(winnerId, genreId) : Promise.resolve(null),
        genreId ? getOrCreateRating(loserId, genreId) : Promise.resolve(null),
    ]);

    const before = { winnerElo: winnerGlobal.elo, loserElo: loserGlobal.elo };
    const { winnerDelta, loserDelta } = calcEloDelta(winnerGlobal.elo, loserGlobal.elo, k);

    await db.h2HRating.update({
        where: { id: winnerGlobal.id },
        data: { elo: winnerGlobal.elo + winnerDelta, wins: winnerGlobal.wins + 1, matchesPlayed: winnerGlobal.matchesPlayed + 1 },
    });
    await db.h2HRating.update({
        where: { id: loserGlobal.id },
        data: { elo: Math.max(0, loserGlobal.elo + loserDelta), losses: loserGlobal.losses + 1, matchesPlayed: loserGlobal.matchesPlayed + 1 },
    });
    if (winnerGenre && loserGenre) {
        const { winnerDelta: wd, loserDelta: ld } = calcEloDelta(winnerGenre.elo, loserGenre.elo, k);
        await db.h2HRating.update({
            where: { id: winnerGenre.id },
            data: { elo: winnerGenre.elo + wd, wins: winnerGenre.wins + 1, matchesPlayed: winnerGenre.matchesPlayed + 1 },
        });
        await db.h2HRating.update({
            where: { id: loserGenre.id },
            data: { elo: Math.max(0, loserGenre.elo + ld), losses: loserGenre.losses + 1, matchesPlayed: loserGenre.matchesPlayed + 1 },
        });
    }
    return {
        before,
        after: { winnerElo: winnerGlobal.elo + winnerDelta, loserElo: Math.max(0, loserGlobal.elo + loserDelta) },
    };
}

async function recordForfeit(userId: string): Promise<void> {
    const r = await getOrCreateRating(userId, null);
    await db.h2HRating.update({ where: { id: r.id }, data: { forfeits: r.forfeits + 1 } });
}

async function pickRandomSamples(_genreId: string | null, _count: number): Promise<string[]> {
    // Deprecated: replaced by pickCategorizedSamples. Kept as a stub for any external callers.
    return [];
}
void pickRandomSamples;

// Mandatory categories every match always gets one of (if available).
const H2H_MANDATORY_CATEGORIES = ['kick', 'snare', 'hat', 'percussion', 'fx'] as const;
// Optional categories � included only when the match's include* flag is true.
const H2H_OPTIONAL_CATEGORIES = ['bass', 'melody', 'chords'] as const;
const H2H_ALL_CATEGORIES = [...H2H_MANDATORY_CATEGORIES, ...H2H_OPTIONAL_CATEGORIES] as const;

async function pickCategorizedSamples(
    genreId: string | null,
    opts: { includeBass: boolean; includeMelody: boolean; includeChords: boolean }
): Promise<string[]> {
    const categories = [
        ...H2H_MANDATORY_CATEGORIES,
        ...(opts.includeBass ? ['bass'] : []),
        ...(opts.includeMelody ? ['melody'] : []),
        ...(opts.includeChords ? ['chords'] : []),
    ];

    const picked: string[] = [];
    for (const cat of categories) {
        // Prefer genre-matching pools, fall back to global pools (genreId null).
        let candidates = await db.h2HSample.findMany({
            where: {
                category: cat,
                pool: { isActive: true, ...(genreId ? { genreId } : {}) },
            },
            select: { id: true },
        });
        if (!candidates.length && genreId) {
            candidates = await db.h2HSample.findMany({
                where: { category: cat, pool: { isActive: true, genreId: null } },
                select: { id: true },
            });
        }
        if (!candidates.length) continue; // category has no samples anywhere � skip silently
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        picked.push(chosen.id);
    }
    return picked;
}

// --- Public endpoints ---

// Genres available for H2H (those with at least one active pool, plus any global pools)
app.get('/api/head-to-head/genres', publicCache(120), async (_req, res) => {
    try {
        const pools = await db.h2HSamplePool.findMany({
            where: { isActive: true },
            include: { genre: true, _count: { select: { samples: true } } },
        });
        const map = new Map<string, any>();
        let globalSamples = 0;
        for (const p of pools) {
            if (!p.genreId) { globalSamples += p._count.samples; continue; }
            const key = p.genreId;
            const existing = map.get(key);
            if (existing) existing.sampleCount += p._count.samples;
            else map.set(key, { id: p.genreId, name: p.genre?.name || 'Unknown', sampleCount: p._count.samples });
        }
        const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        res.json({ genres: list, globalSamples });
    } catch (e: any) {
        logger.error('H2H genres failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Settings (public, sanitized)
app.get('/api/head-to-head/settings', publicCache(60), async (_req, res) => {
    try {
        const s = await getH2HSettings();
        res.json({
            enabled: s.enabled,
            defaultProductionMinutes: s.defaultProductionMinutes,
            defaultVotingMinutes: s.defaultVotingMinutes,
            readyUpMinutes: s.readyUpMinutes,
            startingElo: s.startingElo,
            minVotesToFinalize: s.minVotesToFinalize,
            samplesPerMatch: s.samplesPerMatch,
        });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Leaderboard
app.get('/api/head-to-head/leaderboard', publicCache(30), async (req: any, res) => {
    try {
        const genreId = (req.query.genreId as string | undefined) || null;
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const ratings = await db.h2HRating.findMany({
            where: { genreId: genreId === '' ? null : genreId, matchesPlayed: { gt: 0 } },
            orderBy: { elo: 'desc' },
            take: limit,
            include: { genre: true },
        });
        // Enrich with profile info
        const userIds = ratings.map(r => r.userId);
        const profiles = await db.musicianProfile.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, username: true, displayName: true, avatar: true },
        });
        const pmap = new Map(profiles.map(p => [p.userId, p]));
        res.json(ratings.map((r, i) => ({
            rank: i + 1,
            userId: r.userId,
            elo: r.elo,
            wins: r.wins,
            losses: r.losses,
            forfeits: r.forfeits,
            matchesPlayed: r.matchesPlayed,
            genreId: r.genreId,
            genreName: r.genre?.name || null,
            profile: pmap.get(r.userId) || null,
        })));
    } catch (e: any) {
        logger.error('H2H leaderboard failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Identities are revealed only after the match has truly ended.
const H2H_REVEAL_STATUSES = new Set(['completed', 'forfeited', 'cancelled']);
function anonProfile(userId: string) {
    return { userId, username: null, displayName: null, avatar: null, anonymous: true };
}

// My state: rating + active match + recent matches + queue position
app.get('/api/head-to-head/me', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;        const [globalRating, genreRatings, activeMatch, recent] = await Promise.all([
            getOrCreateRating(userId, null),
            db.h2HRating.findMany({ where: { userId, genreId: { not: null } }, include: { genre: true } }),
            db.h2HMatch.findFirst({
                where: {
                    OR: [{ challengerId: userId }, { opponentId: userId }],
                    status: { in: ['queued', 'ready_check', 'melodics_vote', 'producing', 'voting'] },
                },
                orderBy: { createdAt: 'desc' },
                include: { genre: true },
            }),
            db.h2HMatch.findMany({
                where: {
                    OR: [{ challengerId: userId }, { opponentId: userId }],
                    status: { in: ['completed', 'forfeited', 'cancelled'] },
                },
                orderBy: { updatedAt: 'desc' },
                take: 10,
                include: { genre: true },
            }),
        ]);
        // Attach profiles. Opponent stays masked while the match is still live;
        // both identities are revealed once the match reaches a terminal status.
        const allMatchUserIds = new Set<string>();
        if (activeMatch) {
            allMatchUserIds.add(activeMatch.challengerId);
            if (activeMatch.opponentId) allMatchUserIds.add(activeMatch.opponentId);
        }
        for (const m of recent) {
            allMatchUserIds.add(m.challengerId);
            if (m.opponentId) allMatchUserIds.add(m.opponentId);
        }
        const profiles = await db.musicianProfile.findMany({
            where: { userId: { in: Array.from(allMatchUserIds) } },
            select: { userId: true, username: true, displayName: true, avatar: true },
        });
        const pmap = new Map(profiles.map(p => [p.userId, p]));
        // Pre-load samples for any active/recent match that already has sampleIds.
        const sampleIdSet = new Set<string>();
        const collectIds = (m: any) => {
            const ids = (m?.sampleIds as string[] | null) || [];
            for (const id of ids) sampleIdSet.add(id);
        };
        if (activeMatch) collectIds(activeMatch);
        for (const m of recent) collectIds(m);
        const sampleRows = sampleIdSet.size
            ? await db.h2HSample.findMany({ where: { id: { in: Array.from(sampleIdSet) } } })
            : [];
        const smap = new Map(sampleRows.map(s => [s.id, s]));
        const attach = (m: any) => {
            const reveal = H2H_REVEAL_STATUSES.has(m.status);
            const chReal = pmap.get(m.challengerId) || { userId: m.challengerId, username: null, displayName: null, avatar: null };
            const opReal = m.opponentId ? (pmap.get(m.opponentId) || { userId: m.opponentId, username: null, displayName: null, avatar: null }) : null;
            const chIsMe = m.challengerId === userId;
            const opIsMe = m.opponentId === userId;
            const ids = (m.sampleIds as string[] | null) || [];
            const samples = ids.map(id => smap.get(id)).filter(Boolean);
            return {
                ...m,
                samples,
                challengerProfile: reveal || chIsMe ? chReal : anonProfile(m.challengerId),
                opponentProfile: !m.opponentId ? null : (reveal || opIsMe ? opReal : anonProfile(m.opponentId)),
            };
        };
        res.json({
            userId,
            globalRating: { elo: globalRating.elo, wins: globalRating.wins, losses: globalRating.losses, forfeits: globalRating.forfeits, matchesPlayed: globalRating.matchesPlayed },
            genreRatings: genreRatings.map(g => ({ genreId: g.genreId, genreName: g.genre?.name, elo: g.elo, wins: g.wins, losses: g.losses })),
            activeMatch: activeMatch ? attach(activeMatch) : null,
            recentMatches: recent.map(attach),
        });
    } catch (e: any) {
        logger.error('H2H me failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Join queue
app.post('/api/head-to-head/queue', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const settings = await getH2HSettings();
        if (!settings.enabled) return res.status(403).json({ error: 'Head-to-Head is disabled' });
        const { genreId, productionMinutes } = req.body || {};

        // Block if user already has an active match
        const existing = await db.h2HMatch.findFirst({
            where: {
                OR: [{ challengerId: userId }, { opponentId: userId }],
                status: { in: ['queued', 'ready_check', 'melodics_vote', 'producing', 'voting'] },
            },
        });
        if (existing) return res.status(400).json({ error: 'You already have an active match', matchId: existing.id });

        const prod = Math.max(15, Math.min(720, Number(productionMinutes) || settings.defaultProductionMinutes));
        const match = await db.h2HMatch.create({
            data: {
                challengerId: userId,
                genreId: genreId || null,
                productionMinutes: prod,
                votingMinutes: settings.defaultVotingMinutes,
                status: 'queued',
                // Melodics inclusion is decided by the in-match vote.
                includeBass: false,
                includeMelody: false,
                includeChords: false,
            },
        });
        res.json({ matchId: match.id, status: match.status });
        // Kick the lifecycle right away so the second player into the queue gets paired instantly
        // instead of waiting for the next interval tick.
        runHeadToHeadLifecycle().catch(() => {});
    } catch (e: any) {
        logger.error('H2H queue failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Leave queue (only while still queued)
app.post('/api/head-to-head/queue/leave', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const m = await db.h2HMatch.findFirst({ where: { challengerId: userId, opponentId: null, status: 'queued' } });
        if (!m) return res.status(404).json({ error: 'Not in queue' });
        await db.h2HMatch.update({ where: { id: m.id }, data: { status: 'cancelled' } });
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Match details (with sample URLs only for participants while in producing)
app.get('/api/head-to-head/match/:id', async (req: any, res) => {
    try {
        const match = await db.h2HMatch.findUnique({
            where: { id: req.params.id },
            include: { genre: true, votes: true },
        });
        if (!match) return res.status(404).json({ error: 'Not found' });
        const userId = req.session?.user?.id;
        const isParticipant = userId && (match.challengerId === userId || match.opponentId === userId);
        const sampleIds: string[] = (match.sampleIds as string[] | null) || [];
        let samples: any[] = [];
        if (sampleIds.length && (isParticipant || ['voting', 'completed'].includes(match.status))) {
            samples = await db.h2HSample.findMany({ where: { id: { in: sampleIds } } });
        }
        // Hide submission URLs from voters until voting (or always for non-participants if still producing)
        const sanitized: any = { ...match, samples };
        if (match.status === 'producing' && !isParticipant) {
            sanitized.challengerSubmissionUrl = null;
            sanitized.opponentSubmissionUrl = null;
        }
        // Include profile names
        const ids = [match.challengerId, match.opponentId].filter(Boolean) as string[];
        const profiles = await db.musicianProfile.findMany({
            where: { userId: { in: ids } },
            select: { userId: true, username: true, displayName: true, avatar: true },
        });
        const pmap = new Map(profiles.map(p => [p.userId, p]));
        const reveal = H2H_REVEAL_STATUSES.has(match.status);
        const chReal = pmap.get(match.challengerId) || { userId: match.challengerId, username: null, displayName: null, avatar: null };
        const opReal = match.opponentId ? (pmap.get(match.opponentId) || { userId: match.opponentId, username: null, displayName: null, avatar: null }) : null;
        const chIsMe = userId && match.challengerId === userId;
        const opIsMe = userId && match.opponentId === userId;
        sanitized.challengerProfile = reveal || chIsMe ? chReal : anonProfile(match.challengerId);
        sanitized.opponentProfile = !match.opponentId ? null : (reveal || opIsMe ? opReal : anonProfile(match.opponentId));
        res.json(sanitized);
    } catch (e: any) {
        logger.error('H2H match get failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Ready up
app.post('/api/head-to-head/match/:id/ready', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const match = await db.h2HMatch.findUnique({ where: { id: req.params.id } });
        if (!match) return res.status(404).json({ error: 'Not found' });
        if (match.status !== 'ready_check') return res.status(400).json({ error: 'Not in ready-up phase' });
        const isCh = match.challengerId === userId;
        const isOp = match.opponentId === userId;
        if (!isCh && !isOp) return res.status(403).json({ error: 'Not a participant' });
        await db.h2HMatch.update({
            where: { id: match.id },
            data: isCh ? { challengerReady: true } : { opponentReady: true },
        });
        // If both ready now, advance immediately to the melodics vote
        const fresh = await db.h2HMatch.findUnique({ where: { id: match.id } });
        if (fresh && fresh.challengerReady && fresh.opponentReady) {
            await advanceToMelodicsVote(fresh);
        }
        res.json({ ok: true });
    } catch (e: any) {
        logger.error('H2H ready failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Melodics vote window length � short, since it's a single click per category.
const H2H_MELODICS_VOTE_SECONDS = 45;

async function advanceToMelodicsVote(match: any): Promise<void> {
    // Find which optional categories actually have samples in the chosen genre
    // (or in a global pool as fallback). Categories that don't exist anywhere are
    // pre-set as "no" votes for both players so we don't ask the users about
    // melodics that can't be served.
    const checkCat = async (cat: string): Promise<boolean> => {
        const inGenre = await db.h2HSample.count({
            where: { category: cat, pool: { isActive: true, ...(match.genreId ? { genreId: match.genreId } : {}) } },
        });
        if (inGenre > 0) return true;
        if (!match.genreId) return false;
        const inGlobal = await db.h2HSample.count({
            where: { category: cat, pool: { isActive: true, genreId: null } },
        });
        return inGlobal > 0;
    };
    const [hasBass, hasMelody, hasChords] = await Promise.all([
        checkCat('bass'),
        checkCat('melody'),
        checkCat('chords'),
    ]);

    const now = new Date();
    const deadline = new Date(now.getTime() + H2H_MELODICS_VOTE_SECONDS * 1000);
    const data: any = {
        status: 'melodics_vote',
        melodicsVoteDeadline: deadline,
        // Reset any previous votes
        challengerVoteBass:   hasBass   ? null : false,
        challengerVoteMelody: hasMelody ? null : false,
        challengerVoteChords: hasChords ? null : false,
        opponentVoteBass:     hasBass   ? null : false,
        opponentVoteMelody:   hasMelody ? null : false,
        opponentVoteChords:   hasChords ? null : false,
    };
    await db.h2HMatch.update({ where: { id: match.id }, data });

    // If nothing is available to vote on, skip the vote entirely.
    if (!hasBass && !hasMelody && !hasChords) {
        const fresh = await db.h2HMatch.findUnique({ where: { id: match.id } });
        if (fresh) await resolveMelodicsAndProduce(fresh);
    }
}

// Resolve melodics vote ? AND of both players' votes (null = no). Then advance to producing.
async function resolveMelodicsAndProduce(match: any): Promise<void> {
    const includeBass   = !!match.challengerVoteBass   && !!match.opponentVoteBass;
    const includeMelody = !!match.challengerVoteMelody && !!match.opponentVoteMelody;
    const includeChords = !!match.challengerVoteChords && !!match.opponentVoteChords;
    await db.h2HMatch.update({
        where: { id: match.id },
        data: { includeBass, includeMelody, includeChords },
    });
    await advanceToProduction({ ...match, includeBass, includeMelody, includeChords });
}

// Melodics vote � each player picks bass/melody/chords yes/no. Both must agree
// on a category for it to be included. Auto-resolves when both submitted, or on timeout.
app.post('/api/head-to-head/match/:id/melodics-vote', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const match = await db.h2HMatch.findUnique({ where: { id: req.params.id } });
        if (!match) return res.status(404).json({ error: 'Not found' });
        if (match.status !== 'melodics_vote') return res.status(400).json({ error: 'Not in melodics vote phase' });
        const isCh = match.challengerId === userId;
        const isOp = match.opponentId === userId;
        if (!isCh && !isOp) return res.status(403).json({ error: 'Not a participant' });
        const bass   = !!req.body?.bass;
        const melody = !!req.body?.melody;
        const chords = !!req.body?.chords;
        await db.h2HMatch.update({
            where: { id: match.id },
            data: isCh
                ? { challengerVoteBass: bass, challengerVoteMelody: melody, challengerVoteChords: chords }
                : { opponentVoteBass:   bass, opponentVoteMelody:   melody, opponentVoteChords:   chords },
        });
        const fresh = await db.h2HMatch.findUnique({ where: { id: match.id } });
        // Resolve immediately when both players have voted
        if (fresh
            && fresh.challengerVoteBass   !== null && fresh.opponentVoteBass   !== null
            && fresh.challengerVoteMelody !== null && fresh.opponentVoteMelody !== null
            && fresh.challengerVoteChords !== null && fresh.opponentVoteChords !== null) {
            await resolveMelodicsAndProduce(fresh);
        }
        res.json({ ok: true });
    } catch (e: any) {
        logger.error('H2H melodics vote failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Manual forfeit � allowed during ready_check / melodics_vote / producing.
app.post('/api/head-to-head/match/:id/forfeit', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const match = await db.h2HMatch.findUnique({ where: { id: req.params.id } });
        if (!match) return res.status(404).json({ error: 'Not found' });
        const isCh = match.challengerId === userId;
        const isOp = match.opponentId === userId;
        if (!isCh && !isOp) return res.status(403).json({ error: 'Not a participant' });
        if (!['ready_check', 'melodics_vote', 'producing'].includes(match.status)) {
            return res.status(400).json({ error: 'Cannot forfeit from this phase' });
        }
        if (!match.opponentId) {
            // Solo queue � just cancel
            await db.h2HMatch.update({
                where: { id: match.id },
                data: { status: 'cancelled', forfeitReason: 'Forfeited before opponent matched' },
            });
            return res.json({ ok: true });
        }
        const opponentId = isCh ? match.opponentId : match.challengerId;
        // If we're in producing AND the opponent has already submitted, they win.
        // If we're in producing and neither has submitted, the opponent wins by default
        // (forfeiter walked away from the fight).
        const opponentSubmitted = isCh ? !!match.opponentSubmissionUrl : !!match.challengerSubmissionUrl;
        const youSubmitted      = isCh ? !!match.challengerSubmissionUrl : !!match.opponentSubmissionUrl;
        let winnerId = opponentId;
        let loserId  = userId;
        // Edge case: if the forfeiter actually submitted but the opponent didn't,
        // forfeiting still means they want out � opponent wins.
        if (youSubmitted && !opponentSubmitted) {
            // Same outcome � opponent gets the W because the forfeiter quit.
        }
        await db.h2HMatch.update({
            where: { id: match.id },
            data: {
                status: 'forfeited',
                winnerId, loserId,
                forfeitReason: `${isCh ? 'Challenger' : 'Opponent'} forfeited`,
            },
        });
        await recordForfeit(userId);
        res.json({ ok: true });
    } catch (e: any) {
        logger.error('H2H forfeit failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Same-origin proxy for an individual sample file. Lets the dashboard fetch the
// underlying R2 audio without running into CORS (which silently returned empty
// buffers and produced an "empty" zip with only the README).
app.get('/api/head-to-head/match/:id/sample/:sampleId', async (req: any, res) => {
    try {
        const match = await db.h2HMatch.findUnique({ where: { id: req.params.id } });
        if (!match) return res.status(404).json({ error: 'Not found' });
        const userId = req.session?.user?.id;
        const isParticipant = !!userId && (match.challengerId === userId || match.opponentId === userId);
        const isPublic = ['voting', 'completed'].includes(match.status);
        if (!isParticipant && !isPublic) return res.status(403).json({ error: 'Forbidden' });
        const ids = (match.sampleIds as string[] | null) || [];
        if (!ids.includes(req.params.sampleId)) return res.status(404).json({ error: 'Sample not in this match' });
        const sample = await db.h2HSample.findUnique({ where: { id: req.params.sampleId } });
        if (!sample || !sample.fileUrl) return res.status(404).json({ error: 'Sample not found' });
        const upstream = await fetch(sample.fileUrl);
        if (!upstream.ok || !upstream.body) {
            return res.status(502).json({ error: 'Failed to fetch sample from storage' });
        }
        const ct = upstream.headers.get('content-type') || 'application/octet-stream';
        const len = upstream.headers.get('content-length');
        res.setHeader('Content-Type', ct);
        if (len) res.setHeader('Content-Length', len);
        const ext = sample.fileUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'wav';
        const safeName = (sample.name || 'sample').replace(/[^a-zA-Z0-9._-]/g, '_');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.${ext}"`);
        const reader = (upstream.body as any).getReader();
        try {
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) res.write(Buffer.from(value));
            }
            res.end();
        } catch (streamErr: any) {
            logger.error('H2H sample proxy stream failed', streamErr);
            try { res.end(); } catch {}
        }
    } catch (e: any) {
        logger.error('H2H sample proxy failed', e);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
});

// Same-origin proxy for the two submitted tracks (used by the voting page so we
// can decode audio for waveforms without CORS issues, and so we can keep the
// real R2 URL out of the HTML).
app.get('/api/head-to-head/match/:id/submission/:side', async (req: any, res) => {
    try {
        const match = await db.h2HMatch.findUnique({ where: { id: req.params.id } });
        if (!match) return res.status(404).json({ error: 'Not found' });
        // Submissions are revealed once voting has opened (and stay accessible after)
        if (!['voting', 'completed', 'forfeited'].includes(match.status)) {
            // Allow the participants to fetch their own/opponent's during producing, but only if the user is one of them
            const userId = req.session?.user?.id;
            const isParticipant = !!userId && (match.challengerId === userId || match.opponentId === userId);
            if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });
        }
        const side = req.params.side;
        const url = side === 'challenger' ? match.challengerSubmissionUrl
                  : side === 'opponent'   ? match.opponentSubmissionUrl
                  : null;
        if (!url) return res.status(404).json({ error: 'Submission not found' });
        const upstream = await fetch(url);
        if (!upstream.ok || !upstream.body) {
            return res.status(502).json({ error: 'Failed to fetch submission from storage' });
        }
        const ct = upstream.headers.get('content-type') || 'audio/mpeg';
        const len = upstream.headers.get('content-length');
        res.setHeader('Content-Type', ct);
        if (len) res.setHeader('Content-Length', len);
        res.setHeader('Accept-Ranges', 'bytes');
        const reader = (upstream.body as any).getReader();
        try {
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) res.write(Buffer.from(value));
            }
            res.end();
        } catch (streamErr: any) {
            logger.error('H2H submission proxy stream failed', streamErr);
            try { res.end(); } catch {}
        }
    } catch (e: any) {
        logger.error('H2H submission proxy failed', e);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
});

async function advanceToProduction(match: any): Promise<void> {
    const sampleIds = await pickCategorizedSamples(match.genreId, {
        includeBass: match.includeBass !== false,
        includeMelody: match.includeMelody !== false,
        includeChords: match.includeChords !== false,
    });
    if (!sampleIds.length) {
        logger.warn(`H2H match ${match.id} advancing to production with NO samples (genreId=${match.genreId ?? 'global'}). Check sample pools.`);
    }
    const now = new Date();
    const deadline = new Date(now.getTime() + match.productionMinutes * 60 * 1000);
    await db.h2HMatch.update({
        where: { id: match.id },
        data: {
            status: 'producing',
            sampleIds,
            producingStartedAt: now,
            producingDeadline: deadline,
        },
    });
}

// Submit track (multipart/form-data field "submission")
app.post('/api/head-to-head/match/:id/submit', requireAuth, h2hUpload.single('submission'), async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const match = await db.h2HMatch.findUnique({ where: { id: req.params.id } });
        if (!match) return res.status(404).json({ error: 'Not found' });
        if (match.status !== 'producing') return res.status(400).json({ error: 'Not in production phase' });
        if (match.producingDeadline && new Date() > new Date(match.producingDeadline)) {
            return res.status(400).json({ error: 'Production window has closed' });
        }
        const isCh = match.challengerId === userId;
        const isOp = match.opponentId === userId;
        if (!isCh && !isOp) return res.status(403).json({ error: 'Not a participant' });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        // Allow common audio types
        const mt = (req.file.mimetype || '').toLowerCase();
        if (!/^audio\//.test(mt) && !mt.includes('ogg') && !mt.includes('octet-stream')) {
            return res.status(400).json({ error: 'File must be an audio file' });
        }

        let url: string;
        if (R2Storage.isConfigured()) {
            const ext = (req.file.originalname.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
            const key = R2Storage.buildKey('h2h-submissions', match.id, `${userId}-${Date.now()}.${ext}`);
            url = await R2Storage.uploadBuffer(key, req.file.buffer, req.file.mimetype || 'audio/mpeg');
        } else {
            // Local fallback
            const dir = path.join(PROJECT_ROOT, 'public/uploads/h2h');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const safeName = `${match.id}-${userId}-${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            fs.writeFileSync(path.join(dir, safeName), req.file.buffer);
            url = `/uploads/h2h/${safeName}`;
        }

        await db.h2HMatch.update({
            where: { id: match.id },
            data: isCh
                ? { challengerSubmissionUrl: url, challengerSubmissionAt: new Date() }
                : { opponentSubmissionUrl: url, opponentSubmissionAt: new Date() },
        });

        // If both have submitted, transition immediately
        const fresh = await db.h2HMatch.findUnique({ where: { id: match.id } });
        if (fresh && fresh.challengerSubmissionUrl && fresh.opponentSubmissionUrl) {
            await openVoting(fresh);
        }
        res.json({ ok: true, url });
    } catch (e: any) {
        logger.error('H2H submit failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function openVoting(match: any): Promise<void> {
    const settings = await getH2HSettings();
    const now = new Date();
    const end = new Date(now.getTime() + (match.votingMinutes || settings.defaultVotingMinutes) * 60 * 1000);
    await db.h2HMatch.update({
        where: { id: match.id },
        data: { status: 'voting', votingStart: now, votingEnd: end },
    });
}

// Voting queue: peer-reviewed � only return matches where the viewer also has an active or recently-completed match.
app.get('/api/head-to-head/voting/queue', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        // Any logged-in user can judge — participants are excluded from their own match below.
        const matches = await db.h2HMatch.findMany({
            where: {
                status: 'voting',
                challengerId: { not: userId },
                opponentId: { not: userId },
            },
            orderBy: { votingEnd: 'asc' },
            include: { genre: true, votes: { where: { voterId: userId } } },
            take: 20,
        });
        res.json({
            eligible: true,
            matches: matches.map(m => ({
                ...m,
                myVote: m.votes[0]?.voteFor ?? null,
                // Anonymous voting � voters cannot see the producers' identities until the match completes
                challengerProfile: anonProfile(m.challengerId),
                opponentProfile: m.opponentId ? anonProfile(m.opponentId) : null,
                votes: undefined,
            })),
        });
    } catch (e: any) {
        logger.error('H2H voting queue failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cast a vote on a match
app.post('/api/head-to-head/match/:id/vote', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { voteFor } = req.body || {};
        const match = await db.h2HMatch.findUnique({ where: { id: req.params.id } });
        if (!match) return res.status(404).json({ error: 'Not found' });
        if (match.status !== 'voting') return res.status(400).json({ error: 'Not in voting phase' });
        if (match.challengerId === userId || match.opponentId === userId) {
            return res.status(403).json({ error: 'You cannot vote on your own match' });
        }
        if (![match.challengerId, match.opponentId].includes(voteFor)) {
            return res.status(400).json({ error: 'Invalid vote target' });
        }
        // Any logged-in user can vote (participants in the match are already excluded above)
        await db.h2HVote.upsert({
            where: { matchId_voterId: { matchId: match.id, voterId: userId } },
            create: { matchId: match.id, voterId: userId, voteFor },
            update: { voteFor },
        });
        res.json({ ok: true });
    } catch (e: any) {
        logger.error('H2H vote failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin endpoints ---

app.get('/api/head-to-head/admin/settings', requireAdmin, async (_req, res) => {
    try {
        const s = await getH2HSettings();
        res.json(s);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/head-to-head/admin/settings', requireAdmin, async (req, res) => {
    try {
        const allowed = ['enabled', 'announcementChannelId', 'defaultProductionMinutes', 'defaultVotingMinutes',
            'readyUpMinutes', 'startingElo', 'kFactor', 'minVotesToFinalize', 'maxQueueWaitMinutes', 'samplesPerMatch'];
        const data: any = {};
        for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
        await getH2HSettings();
        const s = await db.headToHeadSettings.update({ where: { guildId: PUBLIC_GUILD_ID_H2H }, data });
        res.json(s);
    } catch (e: any) {
        logger.error('H2H admin settings failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/head-to-head/admin/pools', requireAdmin, async (_req, res) => {
    try {
        const pools = await db.h2HSamplePool.findMany({
            include: { genre: true, samples: true, _count: { select: { samples: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(pools);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/head-to-head/admin/pools', requireAdmin, async (req, res) => {
    try {
        const { name, description, genreId } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Name required' });
        const pool = await db.h2HSamplePool.create({
            data: { name, description: description || null, genreId: genreId || null },
        });
        res.json(pool);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.patch('/api/head-to-head/admin/pools/:id', requireAdmin, async (req, res) => {
    try {
        const data: any = {};
        for (const k of ['name', 'description', 'genreId', 'isActive']) {
            if (req.body[k] !== undefined) data[k] = req.body[k] === '' ? null : req.body[k];
        }
        const pool = await db.h2HSamplePool.update({ where: { id: req.params.id }, data });
        res.json(pool);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/head-to-head/admin/pools/:id', requireAdmin, async (req, res) => {
    try {
        // Best-effort delete of R2 sample objects
        const samples = await db.h2HSample.findMany({ where: { poolId: req.params.id } });
        await Promise.all(samples.map(s => deleteFromStorage(s.fileUrl).catch(() => {})));
        await db.h2HSamplePool.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/head-to-head/admin/pools/:id/samples', requireAdmin, h2hUpload.array('samples', 50), async (req: any, res) => {
    try {
        const pool = await db.h2HSamplePool.findUnique({ where: { id: req.params.id } });
        if (!pool) return res.status(404).json({ error: 'Pool not found' });
        const files: any[] = req.files || [];
        if (!files.length) return res.status(400).json({ error: 'No files uploaded' });

        const validCategories = new Set<string>([...H2H_ALL_CATEGORIES, 'other']);
        const normalizeCat = (raw: any): string => {
            const s = String(raw || '').trim().toLowerCase();
            return validCategories.has(s) ? s : 'other';
        };
        const fallbackCategory = normalizeCat(req.body?.category);
        // Support a parallel categories[] array: same length as files, one entry per file.
        let perFile: string[] | null = null;
        if (Array.isArray(req.body?.categories)) {
            perFile = (req.body.categories as any[]).map(normalizeCat);
        } else if (typeof req.body?.categories === 'string') {
            // Single value form encoding edge case
            perFile = [normalizeCat(req.body.categories)];
        }

        const created: any[] = [];
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const category = perFile && perFile[i] ? perFile[i] : fallbackCategory;
            let url: string;
            if (R2Storage.isConfigured()) {
                const ext = (f.originalname.split('.').pop() || 'wav').toLowerCase().replace(/[^a-z0-9]/g, '') || 'wav';
                const key = R2Storage.buildKey('h2h-samples', pool.id, `${category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
                url = await R2Storage.uploadBuffer(key, f.buffer, f.mimetype || 'audio/wav');
            } else {
                const dir = path.join(PROJECT_ROOT, 'public/uploads/h2h-samples');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const safeName = `${pool.id}-${category}-${Date.now()}-${f.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                fs.writeFileSync(path.join(dir, safeName), f.buffer);
                url = `/uploads/h2h-samples/${safeName}`;
            }
            const sample = await db.h2HSample.create({
                data: {
                    poolId: pool.id,
                    name: f.originalname,
                    category,
                    fileUrl: url,
                    fileType: (f.mimetype || 'audio/wav').split('/')[1] || 'wav',
                    fileSize: f.size || f.buffer.length,
                    uploadedBy: req.session?.user?.id || null,
                },
            });
            created.push(sample);
        }
        res.json({ created });
    } catch (e: any) {
        logger.error('H2H sample upload failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update a sample's category (admin)
app.patch('/api/head-to-head/admin/samples/:id', requireAdmin, async (req, res) => {
    try {
        const validCategories = new Set<string>([...H2H_ALL_CATEGORIES, 'other']);
        const data: any = {};
        if (req.body?.category !== undefined) {
            const c = String(req.body.category).trim().toLowerCase();
            if (!validCategories.has(c)) return res.status(400).json({ error: 'Invalid category' });
            data.category = c;
        }
        if (req.body?.name !== undefined) data.name = String(req.body.name).slice(0, 255);
        const sample = await db.h2HSample.update({ where: { id: req.params.id }, data });
        res.json(sample);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/head-to-head/admin/samples/:id', requireAdmin, async (req, res) => {
    try {
        const s = await db.h2HSample.findUnique({ where: { id: req.params.id } });
        if (!s) return res.status(404).json({ error: 'Not found' });
        await deleteFromStorage(s.fileUrl).catch(() => {});
        await db.h2HSample.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/head-to-head/admin/matches', requireAdmin, async (req: any, res) => {
    try {
        const status = req.query.status as string | undefined;
        const where: any = {};
        if (status) where.status = status;
        const matches = await db.h2HMatch.findMany({
            where,
            include: { genre: true, _count: { select: { votes: true } } },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        res.json(matches);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/head-to-head/admin/matches/:id/cancel', requireAdmin, async (req, res) => {
    try {
        await db.h2HMatch.update({
            where: { id: req.params.id },
            data: { status: 'cancelled', forfeitReason: 'Admin cancelled' },
        });
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Lifecycle ticker ---

async function runHeadToHeadLifecycle(): Promise<void> {
    try {
        const settings = await getH2HSettings();
        if (!settings.enabled) return;
        const now = new Date();

        // 1. Matchmaking � pair queued players within the same genre + production length, prefer closest Elo.
        const queued = await db.h2HMatch.findMany({
            where: { status: 'queued', opponentId: null },
            orderBy: { createdAt: 'asc' },
        });
        const consumed = new Set<string>();
        for (const a of queued) {
            if (consumed.has(a.id)) continue;
            const candidate = queued.find(b =>
                !consumed.has(b.id) &&
                b.id !== a.id &&
                b.challengerId !== a.challengerId &&
                (b.genreId ?? null) === (a.genreId ?? null) &&
                b.productionMinutes === a.productionMinutes
            );
            if (!candidate) continue;
            // Elo distance is informational � we still match within bucket since the queue is small.
            const readyDeadline = new Date(now.getTime() + settings.readyUpMinutes * 60 * 1000);
            await db.h2HMatch.update({
                where: { id: a.id },
                data: {
                    opponentId: candidate.challengerId,
                    status: 'ready_check',
                    readyUpStartedAt: now,
                    readyDeadline,
                },
            });
            // Mark candidate as cancelled (it was a placeholder queue row) � its user is now opponent on `a`.
            await db.h2HMatch.update({
                where: { id: candidate.id },
                data: { status: 'cancelled', forfeitReason: 'Merged into match ' + a.id },
            });
            consumed.add(a.id);
            consumed.add(candidate.id);
        }

        // 2. Ready-check timeouts
        const readyChecks = await db.h2HMatch.findMany({
            where: { status: 'ready_check', readyDeadline: { lte: now } },
        });
        for (const m of readyChecks) {
            if (m.challengerReady && m.opponentReady) {
                await advanceToProduction(m);
            } else if (m.challengerReady && !m.opponentReady && m.opponentId) {
                await db.h2HMatch.update({
                    where: { id: m.id },
                    data: { status: 'forfeited', winnerId: m.challengerId, loserId: m.opponentId, forfeitReason: 'Opponent did not ready up' },
                });
                await recordForfeit(m.opponentId);
            } else if (!m.challengerReady && m.opponentReady && m.opponentId) {
                await db.h2HMatch.update({
                    where: { id: m.id },
                    data: { status: 'forfeited', winnerId: m.opponentId, loserId: m.challengerId, forfeitReason: 'Challenger did not ready up' },
                });
                await recordForfeit(m.challengerId);
            } else {
                await db.h2HMatch.update({
                    where: { id: m.id },
                    data: { status: 'cancelled', forfeitReason: 'Neither player readied up' },
                });
                if (m.opponentId) await recordForfeit(m.opponentId);
                await recordForfeit(m.challengerId);
            }
        }

        // 2b. Melodics vote timeouts � anyone who didn't vote on a category counts as "no".
        const melodicsVotes = await db.h2HMatch.findMany({
            where: { status: 'melodics_vote', melodicsVoteDeadline: { lte: now } },
        });
        for (const m of melodicsVotes) {
            await resolveMelodicsAndProduce(m);
        }

        // 3. Production deadlines
        const producing = await db.h2HMatch.findMany({
            where: { status: 'producing', producingDeadline: { lte: now } },
        });
        for (const m of producing) {
            const chDone = !!m.challengerSubmissionUrl;
            const opDone = !!m.opponentSubmissionUrl;
            if (chDone && opDone) {
                await openVoting(m);
            } else if (chDone && !opDone && m.opponentId) {
                await db.h2HMatch.update({
                    where: { id: m.id },
                    data: { status: 'forfeited', winnerId: m.challengerId, loserId: m.opponentId, forfeitReason: 'Opponent did not submit' },
                });
                await recordForfeit(m.opponentId);
            } else if (!chDone && opDone && m.opponentId) {
                await db.h2HMatch.update({
                    where: { id: m.id },
                    data: { status: 'forfeited', winnerId: m.opponentId, loserId: m.challengerId, forfeitReason: 'Challenger did not submit' },
                });
                await recordForfeit(m.challengerId);
            } else {
                await db.h2HMatch.update({
                    where: { id: m.id },
                    data: { status: 'cancelled', forfeitReason: 'Neither player submitted' },
                });
                if (m.opponentId) await recordForfeit(m.opponentId);
                await recordForfeit(m.challengerId);
            }
        }

        // 4. Voting deadlines / vote thresholds
        const voting = await db.h2HMatch.findMany({
            where: { status: 'voting' },
            include: { votes: true },
        });
        for (const m of voting) {
            const ended = m.votingEnd && new Date(m.votingEnd) <= now;
            if (!ended) continue;
            if (!m.opponentId) continue;
            const chVotes = m.votes.filter(v => v.voteFor === m.challengerId).length;
            const opVotes = m.votes.filter(v => v.voteFor === m.opponentId).length;
            const total = chVotes + opVotes;
            if (total < settings.minVotesToFinalize) {
                // Extend by 50% of voting window if under-voted (max one extension per cycle is fine � idempotent)
                const ext = new Date(now.getTime() + Math.ceil((m.votingMinutes || settings.defaultVotingMinutes) * 30 * 1000));
                await db.h2HMatch.update({ where: { id: m.id }, data: { votingEnd: ext } });
                continue;
            }
            let winnerId: string;
            let loserId: string;
            if (chVotes === opVotes) {
                // Tiebreak: earliest submission wins
                const earliest = (m.challengerSubmissionAt && m.opponentSubmissionAt &&
                    new Date(m.challengerSubmissionAt) <= new Date(m.opponentSubmissionAt))
                    ? m.challengerId : m.opponentId;
                winnerId = earliest;
                loserId = winnerId === m.challengerId ? m.opponentId : m.challengerId;
            } else if (chVotes > opVotes) {
                winnerId = m.challengerId; loserId = m.opponentId;
            } else {
                winnerId = m.opponentId; loserId = m.challengerId;
            }
            const elo = await applyEloUpdate(m, winnerId, loserId);
            await db.h2HMatch.update({
                where: { id: m.id },
                data: {
                    status: 'completed',
                    winnerId, loserId,
                    challengerEloBefore: winnerId === m.challengerId ? elo.before.winnerElo : elo.before.loserElo,
                    challengerEloAfter:  winnerId === m.challengerId ? elo.after.winnerElo  : elo.after.loserElo,
                    opponentEloBefore:   winnerId === m.opponentId   ? elo.before.winnerElo : elo.before.loserElo,
                    opponentEloAfter:    winnerId === m.opponentId   ? elo.after.winnerElo  : elo.after.loserElo,
                },
            });
        }
    } catch (e: any) {
        logger.error('H2H lifecycle failed', e);
    }
}

// Run lifecycle immediately on start, then every 5 seconds (matchmaking + ready/vote/production timers).
runHeadToHeadLifecycle();
setInterval(runHeadToHeadLifecycle, 5_000);

// --- Anti-External Forward --------------------------------------------------

app.get('/api/anti-external-forward/:guildId', requireAuth, async (req: any, res) => {
    try {
        const { guildId } = req.params;
        let settings = await db.antiExternalForwardSettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await db.antiExternalForwardSettings.create({ data: { guildId } });
        }
        res.json(settings);
    } catch (e: any) {
        logger.error(`AEF get settings error: ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/anti-external-forward/:guildId', requireAuth, async (req: any, res) => {
    try {
        const { guildId } = req.params;
        const { enabled, deleteMessage, warnUser, blockInternalForwards, exemptRoleIds, exemptChannelIds, blockedSourceChannelIds, blockedTargetChannelIds, logChannelId } = req.body;
        const data = {
            enabled, deleteMessage, warnUser,
            blockInternalForwards: blockInternalForwards ?? false,
            exemptRoleIds: exemptRoleIds ?? [],
            exemptChannelIds: exemptChannelIds ?? [],
            blockedSourceChannelIds: blockedSourceChannelIds ?? [],
            blockedTargetChannelIds: blockedTargetChannelIds ?? [],
            logChannelId: logChannelId || null,
        };
        const settings = await db.antiExternalForwardSettings.upsert({
            where: { guildId },
            create: { guildId, ...data },
            update: data,
        });
        res.json(settings);
    } catch (e: any) {
        logger.error(`AEF save settings error: ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Track Announcer Settings ----------------------------

app.get('/api/track-announcer/:guildId', requireAuth, async (req: any, res) => {
    try {
        const { guildId } = req.params;
        if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
        let settings = await db.trackAnnouncerSettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await db.trackAnnouncerSettings.create({ data: { guildId } });
        }
        res.json(settings);
    } catch (e: any) {
        logger.error(`Track announcer get settings error: ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/track-announcer/:guildId', requireAuth, async (req: any, res) => {
    try {
        const { guildId } = req.params;
        if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
        const { enabled, channelId, channelId2 } = req.body;
        const data = { enabled: enabled ?? true, channelId: channelId || null, channelId2: channelId2 || null };
        const settings = await db.trackAnnouncerSettings.upsert({
            where: { guildId },
            create: { guildId, ...data },
            update: data,
        });
        res.json(settings);
    } catch (e: any) {
        logger.error(`Track announcer save settings error: ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Charts System ──────────────────────────────────────────────────────

// Get the latest chart for a period
app.get('/api/charts/:period', publicCache(120), async (req: any, res) => {
    try {
        const period = req.params.period;
        if (!['daily', 'weekly', 'alltime'].includes(period)) {
            return res.status(400).json({ error: 'period must be daily, weekly, or alltime' });
        }
        const limit = Math.min(Number(req.query.limit) || 50, 100);

        const cacheKey = `charts-${period}`;
        const cached = getCachedResponse(cacheKey);
        if (cached) return res.json(cached);

        const chart = await chartService.getLatestChart(period as any, limit);
        if (!chart) {
            return res.json({ entries: [], period, takenAt: null });
        }
        setCachedResponse(cacheKey, chart);
        res.json(chart);
    } catch (e: any) {
        logger.error(`Charts GET /${req.params.period}: ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get chart history for a specific track
app.get('/api/charts/:period/track/:trackId', publicCache(120), async (req: any, res) => {
    try {
        const { period, trackId } = req.params;
        if (!['daily', 'weekly', 'alltime'].includes(period)) {
            return res.status(400).json({ error: 'period must be daily, weekly, or alltime' });
        }
        const history = await chartService.getTrackChartHistory(trackId, period as any, 30);
        res.json(history);
    } catch (e: any) {
        logger.error(`Charts history error: ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Manually trigger chart generation (admin only)
app.post('/api/charts/generate', async (req: any, res) => {
    try {
        if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
        // Only allow admins
        const isAdmin = req.session.user.isAdmin || false;
        if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
        const period = req.body.period || 'daily';
        if (!['daily', 'weekly', 'alltime'].includes(period)) {
            return res.status(400).json({ error: 'Invalid period' });
        }
        const snapshotId = await chartService.generateSnapshot(period as any);
        res.json({ success: true, snapshotId });
    } catch (e: any) {
        logger.error(`Charts generate error: ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Scheduled chart generation
let lastDailyChart: string | null = null;
let lastWeeklyChart: string | null = null;

async function runChartGeneration() {
    try {
        const now = new Date();
        const todayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const weekKey = `${now.getFullYear()}-W${Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)}`;

        // Daily chart: generate once per day
        if (lastDailyChart !== todayKey) {
            await chartService.generateSnapshot('daily');
            await chartService.generateSnapshot('alltime');
            lastDailyChart = todayKey;
            logger.info(`[Charts] Generated daily + alltime snapshots for ${todayKey}`);
        }

        // Weekly chart: generate once per week
        if (lastWeeklyChart !== weekKey) {
            await chartService.generateSnapshot('weekly');
            lastWeeklyChart = weekKey;
            logger.info(`[Charts] Generated weekly snapshot for ${weekKey}`);
        }

        // Prune old snapshots (keep 90 per period)
        await chartService.pruneSnapshots(90);
    } catch (err: any) {
        logger.error(`[Charts] Generation error: ${err.message}`);
    }
}

// Run chart generation on startup and every hour
runChartGeneration();
setInterval(runChartGeneration, 60 * 60 * 1000);

// ─── Comment System ─────────────────────────────────────────────────────

// GET comments for a track, profile, or battle entry
app.get('/api/comments', async (req: any, res) => {
    try {
        const { trackId, profileId, battleEntryId, cursor, limit: rawLimit } = req.query;
        if (!trackId && !profileId && !battleEntryId) return res.status(400).json({ error: 'trackId, profileId, or battleEntryId is required' });

        const limit = Math.min(Number(rawLimit) || 50, 100);
        const where: any = { parentId: null }; // top-level only
        if (trackId) where.trackId = trackId;
        if (profileId) where.profileId = profileId;
        if (battleEntryId) where.battleEntryId = battleEntryId;

        const comments = await db.comment.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
            include: {
                replies: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        likes: { select: { userId: true, type: true } },
                    },
                },
                likes: { select: { userId: true, type: true } },
            },
        });

        const hasMore = comments.length > limit;
        if (hasMore) comments.pop();

        // Collect all unique userIds from comments + replies to batch-fetch profiles
        const allUserIds = new Set<string>();
        for (const c of comments) {
            allUserIds.add((c as any).userId);
            for (const r of (c as any).replies || []) allUserIds.add(r.userId);
        }
        // Fetch profiles for all commenters � profile avatar/displayName take priority
        const profiles = allUserIds.size > 0
            ? await db.musicianProfile.findMany({
                where: { userId: { in: [...allUserIds] } },
                select: { userId: true, avatar: true, displayName: true, username: true },
            })
            : [];
        const profileMap = new Map(profiles.map(p => [p.userId, p]));

        // Transform likes into counts + user's vote, overlay profile avatar/displayName
        const currentUserId = req.session?.user?.id || null;
        const transformComment = (c: any) => {
            const likeCount = (c.likes || []).filter((l: any) => l.type === 'like').length;
            const dislikeCount = (c.likes || []).filter((l: any) => l.type === 'dislike').length;
            const userVote = currentUserId ? (c.likes || []).find((l: any) => l.userId === currentUserId)?.type || null : null;
            const { likes: _likes, ...rest } = c;
            // Overlay profile avatar/displayName if the commenter has a musician profile
            const prof = profileMap.get(c.userId);
            if (prof) {
                if (prof.avatar) rest.avatarUrl = prof.avatar;
                rest.username = prof.displayName || prof.username || rest.username;
            }
            return {
                ...rest,
                profileUsername: prof?.username || null,
                likeCount,
                dislikeCount,
                userVote,
                replies: (c.replies || []).map(transformComment),
            };
        };

        res.json({ comments: comments.map(transformComment), hasMore, nextCursor: hasMore ? comments[comments.length - 1]?.id : null });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST create a comment
/** Validate a GIF URL — only allow known CDN domains returned by Klipy/Tenor */
function validateGifUrl(url: unknown): string | null {
    if (!url || typeof url !== 'string') return null;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return null;
        const ALLOWED_GIF_HOSTS = [
            'media.tenor.com',
            'media1.tenor.com',
            'c.tenor.com',
            'media.klipy.com',
            'media1.klipy.com',
            'i.giphy.com',
            'media.giphy.com',
            'media0.giphy.com',
            'media1.giphy.com',
            'media2.giphy.com',
            'media3.giphy.com',
            'media4.giphy.com',
        ];
        if (!ALLOWED_GIF_HOSTS.includes(parsed.hostname)) return null;
        // Must look like an actual media file path
        if (!/\.(gif|mp4|webp|webm)(\?|$)/i.test(parsed.pathname + parsed.search)) return null;
        return url;
    } catch {
        return null;
    }
}

// ─── Comment spam / malicious-link guard ──────────────────────────────────────

// Known IP-logger, phishing, and malware domains
const BLOCKED_LINK_HOSTS = new Set([
    // IP grabbers / loggers
    'grabify.link', 'grabify.io', 'iplogger.org', 'iplogger.com', 'iplogger.ru',
    'yip.su', '2no.co', 'blasze.tk', 'blasze.com', 'ipgrabber.ru', 'ipgrabb.er',
    'cactus.pics', 'gyazo-login.com', 'dis.gd', 'ip-api.io', 'ip-tracker.org',
    'iptracker.net', 'checkip.dyndns.org', 'getipintel.net', 'showmyip.com',
    // Fake Discord / Steam / crypto phishing
    'discord.gift', 'steamcommunity.ru', 'steamcommun1ty.com', 'discordapp.io',
    'discordnitro.gift', 'discordnitro.fun', 'free-nitro.ru', 'discordfree.gift',
    'claimnitro.com', 'nitrogift.xyz', 'nitro-generator.com',
    // Common phishing shorteners abused for malice
    'bit.ly', 'tinyurl.com', 'ow.ly', 't.co', 'shorturl.at', 'rebrand.ly',
    'is.gd', 'buff.ly', 'tiny.cc', 'clck.ru', 'cutt.ly',
]);

// Regex patterns that signal spam or scam content regardless of URLs
const SPAM_PATTERNS: Array<{ re: RegExp; reason: string }> = [
    { re: /(.)\1{20,}/u,                                                reason: 'Excessive repeated characters' },
    { re: /free\s+(nitro|robux|v[\s-]?bucks|gift\s*card|steam\s*key)/i, reason: 'Scam giveaway pattern' },
    { re: /click\s+here\s+(to\s+)?(get|claim|receive)\s+free/i,         reason: 'Scam call-to-action' },
    { re: /your\s+account\s+(has\s+been\s+|is\s+)(hacked|compromised|suspended|banned)/i, reason: 'Phishing scare tactic' },
    { re: /\b(nitro|robux|vbucks)\s+generator\b/i,                      reason: 'Generator scam pattern' },
    { re: /\bdiscord\s*\.?\s*gift\b/i,                                   reason: 'Fake Discord gift link' },
    { re: /airdrop.*crypto|crypto.*airdrop/i,                            reason: 'Crypto airdrop scam' },
    { re: /send\s+\d+\s*(btc|eth|sol|usdt)\s*,?\s*(get|receive)\s+\d+/i, reason: 'Crypto doubling scam' },
];

// Per-user comment rate limit: max 8 per 60 seconds (in-memory, resets on restart — acceptable)
const commentUserRL = new Map<string, { count: number; resetAt: number }>();
const COMMENT_RL_WINDOW = 60_000;
const COMMENT_RL_MAX    = 8;

function extractUrls(text: string): string[] {
    // Matches http(s):// and bare domain.tld/path patterns
    const re = /https?:\/\/[^\s<>"']+|(?<![/@\w])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|gg|ru|xyz|tk|ml|ga|cf|gq|fun|gift|app|dev|tv|me|co|link|click|live|site|online|store|shop)[/\w!?#=&%+\-.]*/gi;
    return text.match(re) ?? [];
}

/**
 * Returns a rejection reason string if the comment content is spam/malicious,
 * or null if it's clean.
 */
function analyseComment(userId: string, content: string): string | null {
    // 1. Per-user rate limit
    const now = Date.now();
    const rl = commentUserRL.get(userId);
    if (rl && now < rl.resetAt) {
        if (rl.count >= COMMENT_RL_MAX) return 'You are posting too fast. Please slow down.';
        rl.count++;
    } else {
        commentUserRL.set(userId, { count: 1, resetAt: now + COMMENT_RL_WINDOW });
    }

    if (!content?.trim()) return null; // no text to analyse (gif-only comment)

    // 2. Spam pattern check
    for (const { re, reason } of SPAM_PATTERNS) {
        if (re.test(content)) return reason;
    }

    // 3. Caps ratio: more than 70% uppercase letters in comments longer than 20 chars is a spam signal
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length > 20) {
        const upperRatio = (content.replace(/[^A-Z]/g, '').length) / letters.length;
        if (upperRatio > 0.70) return 'Excessive use of capital letters';
    }

    // 4. URL / domain check
    const urls = extractUrls(content);
    for (const raw of urls) {
        try {
            const u = raw.startsWith('http') ? new URL(raw) : new URL(`https://${raw}`);
            const host = u.hostname.toLowerCase().replace(/^www\./, '');
            if (BLOCKED_LINK_HOSTS.has(host)) return `Links to ${host} are not permitted`;
            // Subdomain check (e.g. steal.grabify.link)
            for (const blocked of BLOCKED_LINK_HOSTS) {
                if (host.endsWith(`.${blocked}`)) return `Links to ${blocked} are not permitted`;
            }
        } catch {
            // unparseable URL — skip
        }
    }

    return null;
}

app.post('/api/comments', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { content, gifUrl: rawGifUrl, trackId, profileId, battleEntryId, parentId, trackTimestamp } = req.body;
        const gifUrl = validateGifUrl(rawGifUrl);
        if (rawGifUrl && !gifUrl) return res.status(400).json({ error: 'Invalid GIF URL' });

        if (!content?.trim() && !gifUrl) return res.status(400).json({ error: 'Content or GIF is required' });
        // Strip Zalgo combining marks before length check so the limit applies to clean text
        const cleanContent = content ? sanitizeDisplayName(content, 500) : '';
        if (!cleanContent.trim() && !gifUrl) return res.status(400).json({ error: 'Content or GIF is required' });

        const spamReason = analyseComment(userId, cleanContent);
        if (spamReason) return res.status(400).json({ error: spamReason });
        if (cleanContent.length > 500) return res.status(400).json({ error: 'Comment must be 500 characters or fewer' });

        let resolvedTrackId = trackId;
        let resolvedProfileId = profileId;
        let resolvedBattleEntryId = battleEntryId;
        // The actual parent stored in the DB. If the client passed a reply's id
        // as parentId, we roll up to the top-level comment so threading stays
        // flat (single reply level) — the user can still "reply to" a reply.
        let effectiveParentId: string | null = parentId || null;

        if (parentId) {
            // Reply — inherit context from parent. If the parent is itself a
            // reply, walk up to the top-level grandparent so we never create
            // nested threads (UI only renders one level of replies).
            const parent = await db.comment.findUnique({ where: { id: parentId }, select: { trackId: true, profileId: true, battleEntryId: true, parentId: true } });
            if (!parent) return res.status(404).json({ error: 'Parent comment not found' });
            if (parent.parentId) {
                effectiveParentId = parent.parentId;
            }
            resolvedTrackId = parent.trackId;
            resolvedProfileId = parent.profileId;
            resolvedBattleEntryId = parent.battleEntryId;
        } else {
            const targetCount = [resolvedTrackId, resolvedProfileId, resolvedBattleEntryId].filter(Boolean).length;
            if (targetCount === 0) return res.status(400).json({ error: 'trackId, profileId, or battleEntryId is required' });
            if (targetCount > 1) return res.status(400).json({ error: 'Specify only one of trackId, profileId, or battleEntryId' });
        }

        // Resolve username and avatar � prefer MusicianProfile over Discord
        let username = req.session.user.username || 'Unknown';
        let avatarUrl: string | null = null;
        const profile = await db.musicianProfile.findUnique({
            where: { userId },
            select: { avatar: true, displayName: true, username: true },
        });
        if (profile) {
            username = profile.displayName || profile.username || username;
            avatarUrl = profile.avatar || null;
        }
        if (!avatarUrl) {
            try {
                const userRes = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
                    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                });
                if (!profile) username = userRes.data.global_name || userRes.data.username || username;
                if (userRes.data.avatar) {
                    avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${userRes.data.avatar}.png?size=128`;
                }
            } catch {}
        }

        const comment = await db.comment.create({
            data: {
                userId,
                username,
                avatarUrl,
                content: cleanContent.trim(),
                gifUrl: gifUrl || null,
                ...(resolvedTrackId ? { trackId: resolvedTrackId } : {}),
                ...(resolvedProfileId ? { profileId: resolvedProfileId } : {}),
                ...(resolvedBattleEntryId ? { battleEntryId: resolvedBattleEntryId } : {}),
                ...(effectiveParentId ? { parentId: effectiveParentId } : {}),
                ...((resolvedTrackId || resolvedBattleEntryId) && trackTimestamp != null && !effectiveParentId ? { trackTimestamp: Number(trackTimestamp) } : {}),
            },
        });

        // Audit log
        await db.commentLog.create({
            data: {
                commentId: comment.id,
                action: 'created',
                userId,
                content: comment.content,
                gifUrl: comment.gifUrl,
            },
        }).catch(() => {});

        // Action log for audit trail
        const actionType = parentId ? 'comment_replied' : 'comment_created';
        await logAction('GLOBAL', actionType, userId, resolvedTrackId || resolvedProfileId || resolvedBattleEntryId || comment.id, {
            username,
            content: (content || '').trim().slice(0, 120),
            ...(parentId ? { parentId } : {}),
        }).catch(() => {});

        // Notifications (fire-and-forget)
        (async () => {
            try {
                const snippet = (content || '').trim().slice(0, 80) || '(GIF)';
                if (parentId) {
                    // Reply notification � notify the parent comment author
                    const parentComment = await db.comment.findUnique({ where: { id: parentId }, select: { userId: true } });
                    if (parentComment && parentComment.userId !== userId) {
                        let link: string | null = null;
                        if (resolvedTrackId) {
                            const t = await db.track.findUnique({ where: { id: resolvedTrackId }, select: { slug: true, id: true, profile: { select: { username: true } } } });
                            if (t) link = `/track/${t.profile.username}/${t.slug || t.id}`;
                        } else if (resolvedProfileId) {
                            const p = await db.musicianProfile.findUnique({ where: { id: resolvedProfileId }, select: { username: true } });
                            if (p) link = `/profile/${p.username}`;
                        } else if (resolvedBattleEntryId) {
                            link = `/battles/entry/${resolvedBattleEntryId}`;
                        }
                        await db.musicNotification.create({
                            data: { userId: parentComment.userId, type: 'reply', title: `${username} replied to your comment`, message: snippet, link, actorId: userId, actorName: username, actorAvatar: avatarUrl },
                        });
                    }
                } else {
                    // Top-level comment notification � notify the content owner
                    let ownerId: string | null = null;
                    let link: string | null = null;
                    if (resolvedTrackId) {
                        const t = await db.track.findUnique({ where: { id: resolvedTrackId }, select: { slug: true, id: true, profile: { select: { userId: true, username: true } } } });
                        if (t) { ownerId = t.profile.userId; link = `/track/${t.profile.username}/${t.slug || t.id}`; }
                    } else if (resolvedProfileId) {
                        const p = await db.musicianProfile.findUnique({ where: { id: resolvedProfileId }, select: { userId: true, username: true } });
                        if (p) { ownerId = p.userId; link = `/profile/${p.username}`; }
                    } else if (resolvedBattleEntryId) {
                        const be = await db.battleEntry.findUnique({ where: { id: resolvedBattleEntryId }, select: { userId: true } });
                        if (be) { ownerId = be.userId; link = `/battles/entry/${resolvedBattleEntryId}`; }
                    }
                    if (ownerId && ownerId !== userId) {
                        await db.musicNotification.create({
                            data: { userId: ownerId, type: 'comment', title: `${username} commented`, message: snippet, link, actorId: userId, actorName: username, actorAvatar: avatarUrl },
                        });
                    }
                }
            } catch {}
        })();

        res.json(comment);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT edit a comment (own only)
app.put('/api/comments/:commentId', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { commentId } = req.params;
        const { content, gifUrl: rawEditGifUrl } = req.body;
        const gifUrl = validateGifUrl(rawEditGifUrl);
        if (rawEditGifUrl && !gifUrl) return res.status(400).json({ error: 'Invalid GIF URL' });

        const comment = await db.comment.findUnique({ where: { id: commentId } });
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        const isAdmin = (req.session.mutualAdminGuilds as any[])?.length > 0;
        if (comment.userId !== userId && !isAdmin) return res.status(403).json({ error: 'You can only edit your own comments' });

        const cleanEditContent = content ? sanitizeDisplayName(content, 500) : '';
        if (!cleanEditContent.trim() && !gifUrl) return res.status(400).json({ error: 'Content or GIF is required' });
        if (cleanEditContent.length > 500) return res.status(400).json({ error: 'Comment must be 500 characters or fewer' });

        // Admins editing for moderation purposes bypass spam analysis
        if (!isAdmin) {
            const editSpamReason = analyseComment(userId, cleanEditContent);
            if (editSpamReason) return res.status(400).json({ error: editSpamReason });
        }

        const updated = await db.comment.update({
            where: { id: commentId },
            data: {
                content: cleanEditContent.trim(),
                gifUrl: gifUrl || null,
                editedAt: new Date(),
            },
        });

        // Audit log
        await db.commentLog.create({
            data: {
                commentId,
                action: 'edited',
                userId,
                content: updated.content,
                gifUrl: updated.gifUrl,
                metadata: { previousContent: comment.content, previousGifUrl: comment.gifUrl },
            },
        }).catch(() => {});

        await logAction('GLOBAL', 'comment_edited', userId, commentId, {
            previousContent: comment.content?.substring(0, 200),
            newContent: updated.content?.substring(0, 200),
            targetType: comment.trackId ? 'track' : comment.profileId ? 'profile' : 'battleEntry',
            targetEntityId: comment.trackId || comment.profileId || comment.battleEntryId,
        }).catch(() => {});

        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE a comment (own comment, or comment on own track/profile)
app.delete('/api/comments/:commentId', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { commentId } = req.params;

        const comment = await db.comment.findUnique({ where: { id: commentId } });
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        let canDelete = comment.userId === userId; // Own comment

        // Check if user owns the track this comment is on
        if (!canDelete && comment.trackId) {
            const track = await db.track.findUnique({ where: { id: comment.trackId }, select: { profile: { select: { userId: true } } } });
            if (track?.profile?.userId === userId) canDelete = true;
        }

        // Check if user owns the profile this comment is on
        if (!canDelete && comment.profileId) {
            const profile = await db.musicianProfile.findUnique({ where: { id: comment.profileId }, select: { userId: true } });
            if (profile?.userId === userId) canDelete = true;
        }

        // Check if user owns the battle entry this comment is on
        if (!canDelete && comment.battleEntryId) {
            const battleEntry = await db.battleEntry.findUnique({ where: { id: comment.battleEntryId }, select: { userId: true } });
            if (battleEntry?.userId === userId) canDelete = true;
        }

        // Admins can always delete
        if (!canDelete && req.session.mutualAdminGuilds?.length > 0) canDelete = true;

        if (!canDelete) return res.status(403).json({ error: 'You do not have permission to delete this comment' });

        await db.comment.delete({ where: { id: commentId } });

        // Audit log
        await db.commentLog.create({
            data: {
                commentId,
                action: 'deleted',
                userId,
                content: comment.content,
                gifUrl: comment.gifUrl,
                metadata: { deletedByOwner: comment.userId === userId },
            },
        }).catch(() => {});

        await logAction('GLOBAL', 'comment_deleted', userId, commentId, {
            content: comment.content?.substring(0, 200),
            deletedByOwner: comment.userId === userId,
            targetType: comment.trackId ? 'track' : comment.profileId ? 'profile' : 'battleEntry',
            targetEntityId: comment.trackId || comment.profileId || comment.battleEntryId,
        }).catch(() => {});

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST react to a comment (like/dislike toggle)
app.post('/api/comments/:commentId/react', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { commentId } = req.params;
        const { type } = req.body;

        if (!type || !['like', 'dislike'].includes(type)) {
            return res.status(400).json({ error: 'type must be "like" or "dislike"' });
        }

        const comment = await db.comment.findUnique({ where: { id: commentId } });
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        const existing = await db.commentLike.findUnique({
            where: { userId_commentId: { userId, commentId } },
        });

        if (existing) {
            if (existing.type === type) {
                // Same type \u2014 remove the reaction
                await db.commentLike.delete({ where: { id: existing.id } });
                // Log removal
                await logAction('GLOBAL', 'comment_reaction_removed', userId, commentId, { type, commentAuthor: comment.username }).catch(() => {});
            } else {
                // Different type \u2014 switch
                await db.commentLike.update({ where: { id: existing.id }, data: { type } });
                await logAction('GLOBAL', 'comment_reacted', userId, commentId, { type, commentAuthor: comment.username }).catch(() => {});
            }
        } else {
            await db.commentLike.create({ data: { userId, commentId, type } });
            await logAction('GLOBAL', 'comment_reacted', userId, commentId, { type, commentAuthor: comment.username }).catch(() => {});
        }

        // Return updated counts
        const likes = await db.commentLike.findMany({ where: { commentId }, select: { type: true, userId: true } });
        const likeCount = likes.filter(l => l.type === 'like').length;
        const dislikeCount = likes.filter(l => l.type === 'dislike').length;
        const userVote = likes.find(l => l.userId === userId)?.type || null;

        res.json({ likeCount, dislikeCount, userVote });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET Discord server emojis (for emoji picker)
app.get('/api/discord/emojis', async (_req: any, res) => {
    try {
        const guildId = process.env.GUILD_ID;
        if (!guildId) return res.json([]);

        const emojiRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/emojis`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
        });

        const emojis = emojiRes.data.map((e: any) => ({
            id: e.id,
            name: e.name,
            animated: e.animated,
            url: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'png'}?size=48`,
        }));

        res.json(emojis);
    } catch (e: any) {
        res.json([]);
    }
});

// ─── Klipy GIF Proxy ────────────────────────────────────────────────────
// Klipy is a Tenor drop-in replacement (https://docs.klipy.com/migrate-from-tenor)
// Content filtering is configured in the Klipy Partner Dashboard

// ──────────────────────────────────────────────
// Music Notifications
// ──────────────────────────────────────────────

app.get('/api/music/notifications', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const notifications = await db.musicNotification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        // Check if user has a musician profile � if not, prepend a prompt notification
        try {
            const profile = await db.musicianProfile.findUnique({ where: { userId }, select: { id: true } });
            if (!profile) {
                notifications.unshift({
                    id: '_create_profile',
                    userId,
                    type: 'system',
                    title: 'Create your musician profile',
                    message: 'Set up your artist profile to upload tracks, join battles, and connect with other producers.',
                    link: '/profile/setup',
                    actorId: null,
                    actorName: 'Fuji Studio',
                    actorAvatar: null,
                    isRead: false,
                    createdAt: new Date(),
                });
            }
        } catch { /* non-fatal */ }

        res.json(notifications);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/music/notifications/read', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        await db.musicNotification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ──────────────────────────────────────────────
// Track Favourites
// ──────────────────────────────────────────────

// Check if current user has favourited a track
app.get('/api/tracks/:trackId/favourite', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const existing = await db.trackFavourite.findUnique({
            where: { userId_trackId: { userId, trackId: req.params.trackId } },
        });
        res.json({ favourited: !!existing });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Toggle favourite
app.post('/api/tracks/:trackId/favourite', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { trackId } = req.params;

        const track = await db.track.findUnique({ where: { id: trackId }, select: { id: true, title: true, slug: true, profile: { select: { userId: true, username: true } } } });
        if (!track) return res.status(404).json({ error: 'Track not found' });

        const existing = await db.trackFavourite.findUnique({
            where: { userId_trackId: { userId, trackId } },
        });

        if (existing) {
            await db.trackFavourite.delete({ where: { id: existing.id } });
            await logAction('GLOBAL', 'track_unfavourited', userId, trackId, { title: track.title }).catch(() => {});
            res.json({ favourited: false });
        } else {
            await db.trackFavourite.create({ data: { userId, trackId } });
            await logAction('GLOBAL', 'track_favourited', userId, trackId, { title: track.title }).catch(() => {});
            // Notify track owner
            if (track.profile.userId !== userId) {
                const actorProfile = await db.musicianProfile.findUnique({ where: { userId }, select: { avatar: true, displayName: true, username: true } });
                const username = actorProfile?.displayName || actorProfile?.username || req.session.user.username || 'Someone';
                const actorAvatar = actorProfile?.avatar || null;
                db.musicNotification.create({
                    data: {
                        userId: track.profile.userId, type: 'favourite',
                        title: `${username} liked your track`,
                        message: track.title,
                        link: `/track/${track.profile.username}/${track.slug || track.id}`,
                        actorId: userId, actorName: username, actorAvatar,
                    },
                }).catch(() => {});
            }
            res.json({ favourited: true });
        }
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user's favourited tracks
app.get('/api/my-favourites', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const favourites = await db.trackFavourite.findMany({
            where: { userId, track: { deletedAt: null } },
            orderBy: { createdAt: 'desc' },
            include: {
                track: {
                    include: { profile: { select: { userId: true, username: true, displayName: true, avatar: true } }, genres: { include: { genre: true } } },
                },
            },
        });
        res.json(favourites.map(f => f.track).filter(Boolean));
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get favourite count for a track
app.get('/api/tracks/:trackId/favourite-count', async (req: any, res) => {
    try {
        const count = await db.trackFavourite.count({ where: { trackId: req.params.trackId } });
        res.json({ count });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Batch check favourites for multiple tracks
app.post('/api/tracks/favourites/check', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { trackIds } = req.body;
        if (!Array.isArray(trackIds)) return res.status(400).json({ error: 'trackIds array required' });
        const favourites = await db.trackFavourite.findMany({
            where: { userId, trackId: { in: trackIds } },
            select: { trackId: true },
        });
        const set = new Set(favourites.map(f => f.trackId));
        res.json(Object.fromEntries(trackIds.map((id: string) => [id, set.has(id)])));
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ──────────────────────────────────────────────
// Track Reposts
// ──────────────────────────────────────────────

// Check if current user has reposted a track
app.get('/api/tracks/:trackId/repost', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const existing = await db.trackRepost.findUnique({
            where: { userId_trackId: { userId, trackId: req.params.trackId } },
        });
        res.json({ reposted: !!existing });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Toggle repost
app.post('/api/tracks/:trackId/repost', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { trackId } = req.params;

        const track = await db.track.findUnique({ where: { id: trackId }, select: { id: true, title: true, slug: true, profile: { select: { userId: true, username: true } } } });
        if (!track) return res.status(404).json({ error: 'Track not found' });

        if (track.profile && track.profile.userId === userId) {
            return res.status(400).json({ error: "You can't repost your own track" });
        }

        const existing = await db.trackRepost.findUnique({
            where: { userId_trackId: { userId, trackId } },
        });

        if (existing) {
            await db.trackRepost.delete({ where: { id: existing.id } });
            await logAction('GLOBAL', 'track_unreposted', userId, trackId, { title: track.title }).catch(() => {});
            res.json({ reposted: false });
        } else {
            await db.trackRepost.create({ data: { userId, trackId } });
            await logAction('GLOBAL', 'track_reposted', userId, trackId, { title: track.title, owner: track.profile?.username }).catch(() => {});
            // Notify track owner
            if (track.profile.userId !== userId) {
                const actorProfile = await db.musicianProfile.findUnique({ where: { userId }, select: { avatar: true, displayName: true, username: true } });
                const username = actorProfile?.displayName || actorProfile?.username || req.session.user.username || 'Someone';
                const actorAvatar = actorProfile?.avatar || null;
                db.musicNotification.create({
                    data: {
                        userId: track.profile.userId, type: 'repost',
                        title: `${username} reposted your track`,
                        message: track.title,
                        link: `/track/${track.profile.username}/${track.slug || track.id}`,
                        actorId: userId, actorName: username, actorAvatar,
                    },
                }).catch(() => {});
            }
            res.json({ reposted: true });
        }
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get repost count for a track
app.get('/api/tracks/:trackId/repost-count', async (req: any, res) => {
    try {
        const count = await db.trackRepost.count({ where: { trackId: req.params.trackId } });
        res.json({ count });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Batch check reposts for multiple tracks
app.post('/api/tracks/reposts/check', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { trackIds } = req.body;
        if (!Array.isArray(trackIds)) return res.status(400).json({ error: 'trackIds array required' });
        const reposts = await db.trackRepost.findMany({
            where: { userId, trackId: { in: trackIds } },
            select: { trackId: true },
        });
        const set = new Set(reposts.map(r => r.trackId));
        res.json(Object.fromEntries(trackIds.map((id: string) => [id, set.has(id)])));
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ──────────────────────────────────────────────
// Artist Follows
// ──────────────────────────────────────────────

// Check if current user follows an artist
app.get('/api/artists/:artistId/follow', requireAuth, async (req: any, res) => {
    try {
        const followerId = req.session.user.id;
        const existing = await db.artistFollow.findUnique({
            where: { followerId_artistId: { followerId, artistId: req.params.artistId } },
        });
        res.json({ following: !!existing });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Toggle follow
app.post('/api/artists/:artistId/follow', requireAuth, async (req: any, res) => {
    try {
        const followerId = req.session.user.id;
        const { artistId } = req.params;

        const artist = await db.musicianProfile.findUnique({ where: { id: artistId }, select: { id: true, userId: true, username: true } });
        if (!artist) return res.status(404).json({ error: 'Artist not found' });
        if (artist.userId === followerId) return res.status(400).json({ error: 'Cannot follow yourself' });

        const existing = await db.artistFollow.findUnique({
            where: { followerId_artistId: { followerId, artistId } },
        });

        if (existing) {
            await db.artistFollow.delete({ where: { id: existing.id } });
            await logAction('GLOBAL', 'artist_unfollowed', followerId, artistId, { artist: artist.username }).catch(() => {});
            res.json({ following: false });
        } else {
            await db.artistFollow.create({ data: { followerId, artistId } });
            await logAction('GLOBAL', 'artist_followed', followerId, artistId, { artist: artist.username }).catch(() => {});
            // Notify the artist
            const actorProfile = await db.musicianProfile.findUnique({ where: { userId: followerId }, select: { avatar: true, displayName: true, username: true } });
            const username = actorProfile?.displayName || actorProfile?.username || req.session.user.username || 'Someone';
            const actorAvatar = actorProfile?.avatar || null;
            db.musicNotification.create({
                data: {
                    userId: artist.userId, type: 'follow',
                    title: `${username} followed you`,
                    message: 'You have a new follower!',
                    link: `/profile/${artist.username}`,
                    actorId: followerId, actorName: username, actorAvatar,
                },
            }).catch(() => {});
            res.json({ following: true });
        }
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get follower count for an artist
app.get('/api/artists/:artistId/follower-count', async (req: any, res) => {
    try {
        const count = await db.artistFollow.count({ where: { artistId: req.params.artistId } });
        res.json({ count });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user's followed artists
app.get('/api/my-follows', requireAuth, async (req: any, res) => {
    try {
        const followerId = req.session.user.id;
        const follows = await db.artistFollow.findMany({
            where: { followerId },
            orderBy: { createdAt: 'desc' },
            include: { artist: { select: { id: true, userId: true, username: true, displayName: true, avatar: true, bio: true, totalPlays: true } } },
        });
        res.json(follows.map(f => f.artist));
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Feed: tracks from followed artists + reposts, ordered by newest
app.get('/api/feed', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { cursor, limit: rawLimit } = req.query;
        const limit = Math.min(Number(rawLimit) || 30, 50);

        // Get followed artist profile IDs and user IDs
        const follows = await db.artistFollow.findMany({
            where: { followerId: userId },
            select: { artistId: true, artist: { select: { userId: true } } },
        });

        logger.info(`[Feed] userId=${userId} followCount=${follows.length}`);

        if (follows.length === 0) {
            return res.json({ tracks: [], hasMore: false, nextCursor: null });
        }

        const profileIds = follows.map(f => f.artistId);
        const followedUserIds = follows.map(f => f.artist.userId);

        // Fetch original tracks from followed artists
        const tracks = await db.track.findMany({
            where: {
                profileId: { in: profileIds },
                isPublic: true,
            },
            orderBy: { createdAt: 'desc' },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
            select: {
                id: true, title: true, slug: true, url: true, coverUrl: true,
                playCount: true, createdAt: true, duration: true, waveformPeaks: true,
                profile: { select: { userId: true, username: true, displayName: true, avatar: true } },
                genres: { include: { genre: true } },
                _count: { select: { favourites: true, comments: true, reposts: true } },
            },
        });

        const hasMore = tracks.length > limit;
        if (hasMore) tracks.pop();

        // Filter out suspended
        const activeTracks = tracks.filter((t: any) => (!t.status || t.status === 'active') && (!t.profile?.status || t.profile.status === 'active'));

        // Get reposts by followed users (tracks that aren't already in the feed from original artists)
        const existingTrackIds = new Set(activeTracks.map(t => t.id));
        const reposts = await db.trackRepost.findMany({
            where: {
                userId: { in: followedUserIds },
                track: { isPublic: true, deletedAt: null },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                track: {
                    select: {
                        id: true, title: true, slug: true, url: true, coverUrl: true,
                        playCount: true, createdAt: true, duration: true, waveformPeaks: true,
                        profile: { select: { userId: true, username: true, displayName: true, avatar: true } },
                        genres: { include: { genre: true } },
                        _count: { select: { favourites: true, comments: true, reposts: true } },
                    },
                },
            },
        });

        // Add reposts with repost metadata \u2014 skip tracks already in feed
        const repostItems = reposts
            .filter(r => !existingTrackIds.has(r.trackId))
            .map(r => ({
                ...r.track,
                repostedBy: r.userId,
                repostedAt: r.createdAt,
            }));

        // Merge and sort by date (repostedAt for reposts, createdAt for originals)
        const merged = [
            ...activeTracks.map(t => ({ ...t, repostedBy: null, repostedAt: null })),
            ...repostItems,
        ].sort((a, b) => {
            const dateA = a.repostedAt || a.createdAt;
            const dateB = b.repostedAt || b.createdAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        }).slice(0, limit);

        // Resolve repostedBy usernames
        const repostUserIds = [...new Set(merged.filter(t => t.repostedBy).map(t => t.repostedBy!))];
        const repostProfiles = repostUserIds.length > 0
            ? await db.musicianProfile.findMany({ where: { userId: { in: repostUserIds } }, select: { userId: true, username: true, displayName: true } })
            : [];
        const profileMap = new Map(repostProfiles.map(p => [p.userId, p]));

        const finalTracks = merged.map(t => redactTrackUrls({
            ...t,
            repostedBy: t.repostedBy ? (profileMap.get(t.repostedBy) || { username: 'Someone', displayName: null }) : null,
        }));

        logger.info(`[Feed] trackCount=${activeTracks.length} repostCount=${repostItems.length} total=${finalTracks.length}`);

        res.json({ tracks: finalTracks, hasMore, nextCursor: hasMore ? activeTracks[activeTracks.length - 1]?.id : null });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ──────────────────────────────────────────────
// Playlists
// ──────────────────────────────────────────────

function generatePlaylistSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'playlist';
}

// Get popular public playlists
app.get('/api/playlists/popular', publicCache(120), async (_req: any, res) => {
    try {
        const cached = getCachedResponse('popular-playlists');
        if (cached) return res.json(cached);

        const playlists = await db.playlist.findMany({
            where: { isPublic: true, trackCount: { gt: 0 } },
            orderBy: { totalPlays: 'desc' },
            take: 12,
            include: {
                tracks: { where: { track: { deletedAt: null } }, orderBy: { position: 'asc' }, take: 4, include: { track: { select: { id: true, coverUrl: true, title: true } } } },
                profile: { select: { username: true, displayName: true, avatar: true, userId: true } },
            },
        });
        setCachedResponse('popular-playlists', playlists);
        res.json(playlists);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user's playlists
app.get('/api/my-playlists', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const playlists = await db.playlist.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            include: {
                tracks: { where: { track: { deletedAt: null } }, orderBy: { position: 'asc' }, take: 4, include: { track: { select: { id: true, coverUrl: true, title: true } } } },
            },
        });
        res.json(playlists);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create playlist
app.post('/api/playlists', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { name, description, isPublic } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

        // Link to profile if exists
        const profile = await db.musicianProfile.findUnique({ where: { userId }, select: { id: true } });

        let slug = generatePlaylistSlug(name.trim());
        let suffix = 2;
        while (await db.playlist.findFirst({ where: { userId, slug } })) {
            slug = `${generatePlaylistSlug(name.trim())}-${suffix++}`;
        }

        const playlist = await db.playlist.create({
            data: {
                userId,
                profileId: profile?.id || null,
                name: name.trim(),
                slug,
                description: description?.trim() || null,
                isPublic: isPublic !== false,
            },
        });
        await logAction('GLOBAL', 'playlist_created', userId, playlist.id, { name: playlist.name }).catch(() => {});
        res.json(playlist);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single playlist
app.get('/api/playlists/:playlistId', async (req: any, res) => {
    try {
        const playlist = await db.playlist.findUnique({
            where: { id: req.params.playlistId },
            include: {
                tracks: {
                    where: { track: { deletedAt: null } },
                    orderBy: { position: 'asc' },
                    include: {
                        track: {
                            include: { profile: { select: { userId: true, username: true, displayName: true, avatar: true } }, genres: { include: { genre: true } } },
                        },
                    },
                },
                profile: { select: { username: true, displayName: true, avatar: true, userId: true } },
            },
        });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        // Private playlists only visible to owner
        if (!playlist.isPublic) {
            const userId = req.session?.user?.id;
            if (userId !== playlist.userId) return res.status(404).json({ error: 'Playlist not found' });
        }

        res.json(playlist);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update playlist
app.put('/api/playlists/:playlistId', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const playlist = await db.playlist.findUnique({ where: { id: req.params.playlistId } });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        if (playlist.userId !== userId) return res.status(403).json({ error: 'Not your playlist' });

        const { name, description, isPublic, coverUrl, releaseType } = req.body;
        const data: any = {};
        if (name !== undefined) data.name = name.trim();
        if (description !== undefined) data.description = description?.trim() || null;
        if (isPublic !== undefined) data.isPublic = isPublic;
        if (coverUrl !== undefined) data.coverUrl = coverUrl;
        if (releaseType !== undefined) data.releaseType = releaseType || null;

        if (data.name && data.name !== playlist.name) {
            let slug = generatePlaylistSlug(data.name);
            let suffix = 2;
            while (await db.playlist.findFirst({ where: { userId, slug, NOT: { id: playlist.id } } })) {
                slug = `${generatePlaylistSlug(data.name)}-${suffix++}`;
            }
            data.slug = slug;
        }

        const updated = await db.playlist.update({ where: { id: playlist.id }, data });
        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload playlist cover art
app.post('/api/playlists/:playlistId/cover', requireAuth, generalUploadLimiter, upload.single('cover'), async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { playlistId } = req.params;
        const playlist = await db.playlist.findUnique({ where: { id: playlistId } });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        if (playlist.userId !== userId) return res.status(403).json({ error: 'Not your playlist' });

        const coverFile = req.file as Express.Multer.File | undefined;
        if (!coverFile) return res.status(400).json({ error: 'No cover image provided' });

        // Magic byte validation � reject spoofed images
        try {
            FileValidator.validateImage(fs.readFileSync(coverFile.path), coverFile.originalname);
        } catch (validationErr: any) {
            try { fs.unlinkSync(coverFile.path); } catch {}
            return res.status(400).json({ error: validationErr.message });
        }

        await scanFileForViruses(coverFile.path, 'cover');

        const finalPath = await MediaConverter.optimizeImage(coverFile.path);
        const localUrl = `/uploads/artwork/${path.basename(finalPath)}`;
        const r2Key = `playlists/${playlistId}/cover/${path.basename(finalPath)}`;
        const coverUrl = await uploadToR2OrLocal(finalPath, r2Key, 'image/webp', localUrl);

        // Delete old cover from storage if it exists
        if (playlist.coverUrl) {
            await deleteFromStorage(playlist.coverUrl).catch(() => {});
        }

        await db.playlist.update({ where: { id: playlistId }, data: { coverUrl } });
        res.json({ coverUrl });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete playlist
app.delete('/api/playlists/:playlistId', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const playlist = await db.playlist.findUnique({ where: { id: req.params.playlistId } });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        if (playlist.userId !== userId) return res.status(403).json({ error: 'Not your playlist' });

        await db.playlist.delete({ where: { id: playlist.id } });
        await logAction('GLOBAL', 'playlist_deleted', userId, playlist.id, { name: playlist.name }).catch(() => {});
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add track to playlist
app.post('/api/playlists/:playlistId/tracks', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { playlistId } = req.params;
        const { trackId } = req.body;

        const playlist = await db.playlist.findUnique({ where: { id: playlistId } });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        if (playlist.userId !== userId) return res.status(403).json({ error: 'Not your playlist' });

        const track = await db.track.findUnique({ where: { id: trackId }, select: { id: true } });
        if (!track) return res.status(404).json({ error: 'Track not found' });

        // Check duplicate
        const existing = await db.playlistTrack.findUnique({ where: { playlistId_trackId: { playlistId, trackId } } });
        if (existing) return res.status(400).json({ error: 'Track already in playlist' });

        // Get next position
        const maxPos = await db.playlistTrack.findFirst({ where: { playlistId }, orderBy: { position: 'desc' }, select: { position: true } });
        const position = (maxPos?.position ?? -1) + 1;

        await db.playlistTrack.create({ data: { playlistId, trackId, position } });
        await db.playlist.update({ where: { id: playlistId }, data: { trackCount: { increment: 1 } } });
        await logAction('GLOBAL', 'playlist_track_added', userId, playlistId, { trackId, playlist: playlist.name }).catch(() => {});

        // Set cover URL from first track if not set
        if (!playlist.coverUrl) {
            const firstTrack = await db.track.findUnique({ where: { id: trackId }, select: { coverUrl: true } });
            if (firstTrack?.coverUrl) {
                await db.playlist.update({ where: { id: playlistId }, data: { coverUrl: firstTrack.coverUrl } });
            }
        }

        res.json({ success: true, position });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove track from playlist
app.delete('/api/playlists/:playlistId/tracks/:trackId', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { playlistId, trackId } = req.params;

        const playlist = await db.playlist.findUnique({ where: { id: playlistId } });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        if (playlist.userId !== userId) return res.status(403).json({ error: 'Not your playlist' });

        const entry = await db.playlistTrack.findUnique({ where: { playlistId_trackId: { playlistId, trackId } } });
        if (!entry) return res.status(404).json({ error: 'Track not in playlist' });

        await db.playlistTrack.delete({ where: { id: entry.id } });
        await db.playlist.update({ where: { id: playlistId }, data: { trackCount: { decrement: 1 } } });
        await logAction('GLOBAL', 'playlist_track_removed', userId, playlistId, { trackId, playlist: playlist.name }).catch(() => {});

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reorder playlist tracks
app.put('/api/playlists/:playlistId/reorder', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { playlistId } = req.params;
        const { trackIds } = req.body; // Ordered array of track IDs

        const playlist = await db.playlist.findUnique({ where: { id: playlistId } });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        if (playlist.userId !== userId) return res.status(403).json({ error: 'Not your playlist' });

        if (!Array.isArray(trackIds)) return res.status(400).json({ error: 'trackIds array required' });

        // Update positions in a transaction
        await db.$transaction(
            trackIds.map((trackId: string, index: number) =>
                db.playlistTrack.updateMany({
                    where: { playlistId, trackId },
                    data: { position: index },
                })
            )
        );

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reorder playlists on profile sidebar
app.put('/api/playlists/profile-positions', requireAuth, async (req: any, res) => {
    try {
        const userId = req.session.user.id;
        const { playlistIds } = req.body;
        if (!Array.isArray(playlistIds) || playlistIds.length === 0) {
            return res.status(400).json({ error: 'playlistIds array required' });
        }
        const owned = await db.playlist.count({ where: { id: { in: playlistIds }, userId } });
        if (owned !== playlistIds.length) return res.status(403).json({ error: 'Forbidden' });
        await db.$transaction(
            playlistIds.map((id: string, idx: number) => db.playlist.update({ where: { id }, data: { profilePosition: idx } }))
        );
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Record playlist play (increments totalPlays)
app.post('/api/playlists/:playlistId/play', async (req: any, res) => {
    try {
        await db.playlist.update({
            where: { id: req.params.playlistId },
            data: { totalPlays: { increment: 1 } },
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Public Activity Feed ───────────────────────────────────────────────
app.get('/api/activity/public', async (_req: any, res) => {
    try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

        const [recentTracks, recentFollows, recentBattleEntries, recentFavourites] = await Promise.all([
            db.track.findMany({
                where: { isPublic: true, status: 'active', createdAt: { gte: since } },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { profile: { select: { userId: true, username: true, displayName: true, avatar: true } } },
            }),
            db.artistFollow.findMany({
                where: { createdAt: { gte: since } },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { artist: { select: { userId: true, username: true, displayName: true, avatar: true } } },
            }),
            db.battleEntry.findMany({
                where: { createdAt: { gte: since } },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: { id: true, userId: true, username: true, avatarUrl: true, trackTitle: true, coverUrl: true, battleId: true, createdAt: true },
            }),
            db.trackFavourite.findMany({
                where: { createdAt: { gte: since }, track: { deletedAt: null } },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { track: { select: { id: true, title: true, coverUrl: true, profile: { select: { username: true, displayName: true } } } } },
            }),
        ]);

        const items: any[] = [];

        for (const t of recentTracks) {
            items.push({
                type: 'track_upload',
                actorId: t.profile.userId,
                actorName: t.profile.displayName || t.profile.username,
                actorAvatar: t.profile.avatar,
                target: { id: t.id, title: t.title, coverUrl: t.coverUrl, slug: t.slug, artistUsername: t.profile.username },
                createdAt: t.createdAt,
            });
        }

        for (const f of recentFollows) {
            // Look up follower profile for display
            const followerProfile = await db.musicianProfile.findUnique({ where: { userId: f.followerId }, select: { username: true, displayName: true, avatar: true } });
            items.push({
                type: 'follow',
                actorId: f.followerId,
                actorName: followerProfile?.displayName || followerProfile?.username || 'Someone',
                actorAvatar: followerProfile?.avatar || null,
                target: { id: f.artist.userId, name: f.artist.displayName || f.artist.username },
                createdAt: f.createdAt,
            });
        }

        for (const e of recentBattleEntries) {
            items.push({
                type: 'battle_entry',
                actorId: e.userId,
                actorName: e.username,
                actorAvatar: e.avatarUrl,
                target: { id: e.battleId, title: e.trackTitle, coverUrl: e.coverUrl },
                createdAt: e.createdAt,
            });
        }

        for (const fav of recentFavourites) {
            // Look up who favourited
            const favProfile = await db.musicianProfile.findUnique({ where: { userId: fav.userId }, select: { username: true, displayName: true, avatar: true } });
            items.push({
                type: 'favourite',
                actorId: fav.userId,
                actorName: favProfile?.displayName || favProfile?.username || 'Someone',
                actorAvatar: favProfile?.avatar || null,
                target: { id: fav.track.id, title: fav.track.title, coverUrl: fav.track.coverUrl },
                createdAt: fav.createdAt,
            });
        }

        // Sort by date descending and return top 20
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json(items.slice(0, 20));
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Klipy GIF Proxy (continued) ────────────────────────────────────────

app.get('/api/klipy/featured', async (_req: any, res) => {
    try {
        const key = process.env.KLIPY_API_KEY;
        if (!key) return res.json({ results: [] });

        const klipyRes = await axios.get('https://api.klipy.com/v2/featured', {
            params: { key, limit: 30, media_filter: 'tinygif,nanogif,gif' },
        });

        res.json({ results: klipyRes.data.results || [] });
    } catch {
        res.json({ results: [] });
    }
});

app.get('/api/klipy/search', async (req: any, res) => {
    try {
        const key = process.env.KLIPY_API_KEY;
        const q = req.query.q;
        if (!key || !q) return res.json({ results: [] });

        const klipyRes = await axios.get('https://api.klipy.com/v2/search', {
            params: { key, q, limit: 30, media_filter: 'tinygif,nanogif,gif' },
        });

        res.json({ results: klipyRes.data.results || [] });
    } catch {
        res.json({ results: [] });
    }
});

// --- Fuji FM (Radio) Plugin Routes ---------------------------------------------

// GET radio settings
app.get('/api/radio/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    let settings = await db.radioSettings.findUnique({ where: { guildId } });
    if (!settings) {
      await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
      settings = await db.radioSettings.create({ data: { guildId } });
    }
    res.json(settings);
  } catch (error) {
    logger.error('Failed to get radio settings', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// POST update radio settings
app.post('/api/radio/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    logger.info(`[API] POST /api/radio/settings/${guildId} body=${JSON.stringify(req.body)}`);
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) {
      logger.warn(`[API] POST /api/radio/settings/${guildId} ? 403 Forbidden`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const allowedFields = [
      'voiceChannelId', 'textChannelId', 'autoEnabled', 'autoSource',
      'autoGenreFilter', 'ttsAnnounce', 'adsEnabled', 'adFrequency',
      'adTtsDefault', 'listenerXpEnabled', 'listenerXpPerMinute',
      'listenerCoinEnabled', 'listenerCoinsPerMinute',
      'tipEnabled', 'minTipAmount', 'defaultVolume', 'duckVolume',
      'startRoleIds', 'stopRoleIds', 'skipRoleIds', 'hostRoleIds',
      'stationStatus',
    ];

    const data: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    // Validate numeric bounds
    if (data.defaultVolume !== undefined && (data.defaultVolume < 0 || data.defaultVolume > 1)) {
      return res.status(400).json({ error: 'defaultVolume must be between 0 and 1' });
    }
    if (data.duckVolume !== undefined && (data.duckVolume < 0 || data.duckVolume > 1)) {
      return res.status(400).json({ error: 'duckVolume must be between 0 and 1' });
    }
    if (data.adFrequency !== undefined && (data.adFrequency < 1 || data.adFrequency > 100)) {
      return res.status(400).json({ error: 'adFrequency must be between 1 and 100' });
    }

    const settings = await db.radioSettings.upsert({
      where: { guildId },
      update: data,
      create: { guildId, ...data },
    });

    res.json(settings);
  } catch (error) {
    logger.error('Failed to update radio settings', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST radio control command (skip, stop, pause, resume, start)
app.post('/api/radio/control/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    const { action } = req.body;
    const validActions = ['skip', 'stop', 'pause', 'resume', 'start'];
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
    }

    const command = await db.radioCommand.create({
      data: {
        guildId,
        action,
        payload: req.body.payload || undefined,
      },
    });

    // Poll for completion (bot processes commands every 2s) � wait up to 6s
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const updated = await db.radioCommand.findUnique({ where: { id: command.id } });
      if (updated && updated.status !== 'pending') {
        return res.json({ success: updated.status === 'done', result: updated.result, status: updated.status });
      }
    }

    res.json({ success: true, status: 'queued', message: 'Command queued, bot will process shortly' });
  } catch (error) {
    logger.error('Failed to send radio control command', error);
    res.status(500).json({ error: 'Failed to send command' });
  }
});

// GET radio state (what's playing, queue, listeners)
app.get('/api/radio/state/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    const settings = await db.radioSettings.findUnique({ where: { guildId } });

    // Queue count
    const queueCount = await db.radioQueue.count({ where: { guildId, playedAt: null } });

    // Use live state fields written by the bot process
    const online = settings?.isOnline ?? false;
    const nowPlaying = (online && settings?.currentTrackTitle) ? {
      trackTitle: settings.currentTrackTitle,
      artistName: settings.currentArtistName ?? 'Unknown',
      coverUrl: settings.currentCoverUrl ?? null,
      duration: settings.currentDuration ?? 0,
      playedAt: settings.currentStartedAt ?? new Date(),
      listenCount: settings.currentListeners ?? 0,
    } : null;

    res.json({
      online,
      nowPlaying,
      queueCount,
      stationStatus: settings?.stationStatus ?? '',
      settings: settings || null,
    });
  } catch (error) {
    logger.error('Failed to get radio state', error);
    res.status(500).json({ error: 'Failed to get state' });
  }
});

// GET radio history
app.get('/api/radio/history/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const history = await db.radioHistory.findMany({
      where: { guildId },
      orderBy: { playedAt: 'desc' },
      take: limit,
    });
    res.json(history);
  } catch (error) {
    logger.error('Failed to get radio history', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// GET radio queue (from DB)
app.get('/api/radio/queue/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    const queue = await db.radioQueue.findMany({
      where: { guildId, playedAt: null, track: { deletedAt: null } },
      orderBy: { position: 'asc' },
      include: { track: { include: { profile: true } } },
      take: 50,
    });
    res.json(queue);
  } catch (error) {
    logger.error('Failed to get radio queue', error);
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// POST add track to radio queue
app.post('/api/radio/queue/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    const { trackId } = req.body;
    if (!trackId) return res.status(400).json({ error: 'trackId required' });

    const track = await db.track.findUnique({ where: { id: trackId }, include: { profile: true } });
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const position = await db.radioQueue.count({ where: { guildId, playedAt: null } });
    const entry = await db.radioQueue.create({
      data: { guildId, trackId, addedBy: (req as any).user?.id, position: position + 1 },
      include: { track: { include: { profile: true } } },
    });
    res.json(entry);
  } catch (error) {
    logger.error('Failed to add to radio queue', error);
    res.status(500).json({ error: 'Failed to add to queue' });
  }
});

// DELETE remove track from radio queue
app.delete('/api/radio/queue/:guildId/:queueId', async (req, res) => {
  try {
    const { guildId, queueId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    await db.radioQueue.deleteMany({ where: { id: queueId, guildId } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove from radio queue', error);
    res.status(500).json({ error: 'Failed to remove from queue' });
  }
});

// PUT reorder radio queue
app.put('/api/radio/queue/:guildId/reorder', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: 'orderedIds array required' });
    }

    // Validate all IDs belong to this guild and are unplayed
    const existing = await db.radioQueue.findMany({
      where: { guildId, playedAt: null, id: { in: orderedIds } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e: any) => e.id));
    const valid = orderedIds.every((id: string) => existingIds.has(id));
    if (!valid) return res.status(400).json({ error: 'Invalid queue IDs' });

    // Update positions in a transaction
    await db.$transaction(
      orderedIds.map((id: string, index: number) =>
        db.radioQueue.update({ where: { id }, data: { position: index + 1 } })
      )
    );

    // Return updated queue
    const queue = await db.radioQueue.findMany({
      where: { guildId, playedAt: null, track: { deletedAt: null } },
      orderBy: { position: 'asc' },
      include: { track: { include: { profile: true } } },
      take: 50,
    });
    res.json(queue);
  } catch (error) {
    logger.error('Failed to reorder radio queue', error);
    res.status(500).json({ error: 'Failed to reorder queue' });
  }
});

// GET radio ad slots
app.get('/api/radio/ads/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    const ads = await db.radioAdSlot.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(ads);
  } catch (error) {
    logger.error('Failed to get radio ads', error);
    res.status(500).json({ error: 'Failed to get ads' });
  }
});

// POST create ad slot (self-serve purchase)
app.post('/api/radio/ads/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    const { adType, adText, audioUrl, costPaid, playsRequested } = req.body;
    if (!adType || !['tts', 'audio'].includes(adType)) {
      return res.status(400).json({ error: 'adType must be "tts" or "audio"' });
    }
    if (adType === 'tts' && (!adText || adText.length > 200)) {
      return res.status(400).json({ error: 'adText required and max 200 chars' });
    }

    const ad = await db.radioAdSlot.create({
      data: {
        guildId,
        userId: (req as any).user?.id || 'unknown',
        adType,
        adText: adText || null,
        audioUrl: audioUrl || null,
        costPaid: costPaid || 0,
        playsLeft: playsRequested || 3,
        approved: false,
        active: false,
      },
    });
    res.json(ad);
  } catch (error) {
    logger.error('Failed to create radio ad', error);
    res.status(500).json({ error: 'Failed to create ad' });
  }
});

// POST approve/toggle ad slot (admin)
app.post('/api/radio/ads/:guildId/:adId/approve', async (req, res) => {
  try {
    const { guildId, adId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    const ad = await db.radioAdSlot.findFirst({ where: { id: adId, guildId } });
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const updated = await db.radioAdSlot.update({
      where: { id: adId },
      data: { approved: !ad.approved, active: !ad.approved },
    });
    res.json(updated);
  } catch (error) {
    logger.error('Failed to approve radio ad', error);
    res.status(500).json({ error: 'Failed to approve ad' });
  }
});

// DELETE remove ad slot
app.delete('/api/radio/ads/:guildId/:adId', async (req, res) => {
  try {
    const { guildId, adId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    await db.radioAdSlot.deleteMany({ where: { id: adId, guildId } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete radio ad', error);
    res.status(500).json({ error: 'Failed to delete ad' });
  }
});

// GET search tracks for queue (reuse existing tracks)
app.get('/api/radio/tracks/search/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'fuji-radio')) return res.status(403).json({ error: 'Forbidden' });

    const q = (req.query.q as string || '').trim();
    if (!q) return res.json([]);

    const tracks = await db.track.findMany({
      where: {
        isPublic: true,
        status: 'active',
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { profile: { displayName: { contains: q, mode: 'insensitive' } } },
          { profile: { username: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { profile: { select: { displayName: true, username: true, avatar: true } } },
      take: 20,
      orderBy: { playCount: 'desc' },
    });
    res.json(tracks);
  } catch (error) {
    logger.error('Failed to search radio tracks', error);
    res.status(500).json({ error: 'Failed to search tracks' });
  }
});

// --- Studio Guide Settings -------------------------------------------------

app.get('/api/studio-guide/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'studio-guide')) return res.status(403).json({ error: 'Forbidden' });

    let settings = await db.studioGuideSettings.findUnique({ where: { guildId } });
    if (!settings) {
      await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
      settings = await db.studioGuideSettings.create({ data: { guildId } });
    }
    res.json(settings);
  } catch (error) {
    logger.error('Failed to get studio-guide settings', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

app.post('/api/studio-guide/settings/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'studio-guide')) return res.status(403).json({ error: 'Forbidden' });

    const allowedFields = ['enabled', 'channelId', 'pauseRoles', 'cooldownSeconds', 'systemPrompt', 'model', 'suppressionRoles', 'suppressionMinutes'];
    const data: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        data[key] = req.body[key];
      }
    }

    // Validate types
    if (data.cooldownSeconds !== undefined) data.cooldownSeconds = Math.max(0, Math.min(300, Number(data.cooldownSeconds) || 30));
    if (data.suppressionMinutes !== undefined) data.suppressionMinutes = Math.max(1, Math.min(60, Number(data.suppressionMinutes) || 10));
    if (data.model !== undefined && !['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'].includes(data.model)) {
      return res.status(400).json({ error: 'Invalid model' });
    }

    const settings = await db.studioGuideSettings.upsert({
      where: { guildId },
      update: data,
      create: { guildId, ...data },
    });
    res.json(settings);
  } catch (error) {
    logger.error('Failed to update studio-guide settings', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.get('/api/studio-guide/conversations/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'studio-guide')) return res.status(403).json({ error: 'Forbidden' });

    const conversations = await db.studioGuideConversation.findMany({
      where: { guildId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, userId: true, channelId: true, topic: true, active: true, createdAt: true, updatedAt: true },
    });
    res.json(conversations);
  } catch (error) {
    logger.error('Failed to get studio-guide conversations', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

app.get('/api/studio-guide/conversations/:guildId/:conversationId', async (req, res) => {
  try {
    const { guildId, conversationId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'studio-guide')) return res.status(403).json({ error: 'Forbidden' });

    const convo = await db.studioGuideConversation.findFirst({
      where: { id: conversationId, guildId },
      select: { id: true, userId: true, channelId: true, topic: true, active: true, messages: true, createdAt: true, updatedAt: true },
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    res.json(convo);
  } catch (error) {
    logger.error('Failed to get studio-guide conversation', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// -- Studio Guide Knowledge Base CRUD ------------------------------------------

app.get('/api/studio-guide/knowledge/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'studio-guide')) return res.status(403).json({ error: 'Forbidden' });
    const entries = await db.studioGuideKnowledge.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(entries);
  } catch (error) {
    logger.error('Failed to get studio-guide knowledge', error);
    res.status(500).json({ error: 'Failed to get knowledge entries' });
  }
});

app.post('/api/studio-guide/knowledge/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    if (!await checkPluginAccess(guildId, req, 'studio-guide')) return res.status(403).json({ error: 'Forbidden' });

    const { title, content, category } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) return res.status(400).json({ error: 'title is required' });
    if (!content || typeof content !== 'string' || content.trim().length === 0) return res.status(400).json({ error: 'content is required' });

    await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
    const entry = await db.studioGuideKnowledge.create({
      data: {
        guildId,
        title: title.trim().substring(0, 200),
        content: content.trim().substring(0, 4000),
        category: (typeof category === 'string' && category.trim()) ? category.trim().substring(0, 50) : 'general',
      },
    });
    res.json(entry);
  } catch (error) {
    logger.error('Failed to create studio-guide knowledge entry', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

app.patch('/api/studio-guide/knowledge/:guildId/:id', async (req, res) => {
  try {
    const { guildId, id } = req.params;
    if (!await checkPluginAccess(guildId, req, 'studio-guide')) return res.status(403).json({ error: 'Forbidden' });

    const existing = await db.studioGuideKnowledge.findFirst({ where: { id, guildId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const allowedFields = ['title', 'content', 'category', 'enabled'];
    const data: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (typeof data.title === 'string') data.title = data.title.trim().substring(0, 200);
    if (typeof data.content === 'string') data.content = data.content.trim().substring(0, 4000);
    if (typeof data.category === 'string') data.category = data.category.trim().substring(0, 50);

    const entry = await db.studioGuideKnowledge.update({ where: { id }, data });
    res.json(entry);
  } catch (error) {
    logger.error('Failed to update studio-guide knowledge entry', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

app.delete('/api/studio-guide/knowledge/:guildId/:id', async (req, res) => {
  try {
    const { guildId, id } = req.params;
    if (!await checkPluginAccess(guildId, req, 'studio-guide')) return res.status(403).json({ error: 'Forbidden' });

    const existing = await db.studioGuideKnowledge.findFirst({ where: { id, guildId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await db.studioGuideKnowledge.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete studio-guide knowledge entry', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// =============================================
// INVITE MANAGEMENT (Private Beta)
// =============================================

// Public: Check if invite-only mode is active (always false — site is publicly launched)
app.get('/api/beta/status', (req, res) => {
    res.json({ inviteOnly: false });
});

// =============================================
// BETA ACCESS ROLE SETTINGS
// =============================================
app.get('/api/guilds/:guildId/beta-access', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Admin only' });
        const rows: any[] = await db.$queryRaw`SELECT "betaRoleIds" FROM "dashboard_access" WHERE "guildId" = ${guildId} LIMIT 1`;
        res.json({ betaRoleIds: rows[0]?.betaRoleIds || [] });
    } catch (e) {
        logger.error('[Beta] Failed to get beta access settings', e);
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

app.put('/api/guilds/:guildId/beta-access', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Admin only' });
        const { betaRoleIds } = req.body;
        if (!Array.isArray(betaRoleIds)) return res.status(400).json({ error: 'betaRoleIds must be an array' });
        const cleaned = betaRoleIds.filter((r: any) => typeof r === 'string' && r.length > 0);
        // Use raw SQL to bypass Prisma client needing regeneration for betaRoleIds
        await db.$executeRaw`
            INSERT INTO "dashboard_access" ("id", "guildId", "betaRoleIds")
            VALUES (gen_random_uuid(), ${guildId}, ${cleaned}::text[])
            ON CONFLICT ("guildId") DO UPDATE SET "betaRoleIds" = ${cleaned}::text[]
        `;
        logger.info(`[Beta] Updated beta role IDs for guild ${guildId}: ${cleaned.join(', ')}`);
        res.json({ betaRoleIds: cleaned });
    } catch (e) {
        logger.error('[Beta] Failed to update beta access settings', e);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Admin: List all users with invite status
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await db.user.findMany({
            select: { id: true, username: true, displayName: true, email: true, discordId: true, invited: true, role: true, createdAt: true, lastLoginAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    } catch (e) {
        logger.error('Failed to fetch users', e);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Admin: Invite a user (set invited=true)
app.post('/api/admin/users/:userId/invite', requireAdmin, async (req, res) => {
    try {
        const user = await db.user.update({
            where: { id: req.params.userId },
            data: { invited: true },
            select: { id: true, username: true, invited: true },
        });
        res.json(user);
    } catch (e) {
        logger.error('Failed to invite user', e);
        res.status(500).json({ error: 'Failed to invite user' });
    }
});

// Admin: Revoke invite
app.post('/api/admin/users/:userId/revoke', requireAdmin, async (req, res) => {
    try {
        const user = await db.user.update({
            where: { id: req.params.userId },
            data: { invited: false },
            select: { id: true, username: true, invited: true },
        });
        res.json(user);
    } catch (e) {
        logger.error('Failed to revoke user invite', e);
        res.status(500).json({ error: 'Failed to revoke invite' });
    }
});

// Admin: Update user role
app.post('/api/admin/users/:userId/role', requireAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'admin', 'moderator'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const user = await db.user.update({
            where: { id: req.params.userId },
            data: { role },
            select: { id: true, username: true, role: true },
        });
        res.json(user);
    } catch (e) {
        logger.error('Failed to update user role', e);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Admin: Bulk invite users
app.post('/api/admin/users/bulk-invite', requireAdmin, async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'userIds array required' });
        }
        await db.user.updateMany({
            where: { id: { in: userIds } },
            data: { invited: true },
        });
        res.json({ success: true, count: userIds.length });
    } catch (e) {
        logger.error('Failed to bulk invite users', e);
        res.status(500).json({ error: 'Failed to bulk invite' });
    }
});

// -- Repair orphaned profile/tracks for a Discord user (admin only) ----------
// Undeletes soft-deleted MusicianProfile and/or its tracks, and makes all
// tracks public. Use when admin deleted the wrong account and the profile/tracks
// became invisible.
app.post('/api/admin/users/:discordId/repair-profile', requireAdmin, async (req: any, res) => {
    try {
        const { discordId } = req.params;

        // 1. Restore soft-deleted MusicianProfile for this Discord user
        const profile = await db.musicianProfile.findFirst({
            where: { userId: discordId, deletedAt: { not: null } },
        });
        if (profile) {
            await db.musicianProfile.update({ where: { id: profile.id }, data: { deletedAt: null } });
            logger.info(`[Repair] Restored soft-deleted MusicianProfile ${profile.id} for discordId ${discordId}`);
        }

        // Also find active profile (in case it was never deleted)
        const activeProfile = await db.musicianProfile.findFirst({ where: { userId: discordId } });
        const profileId = activeProfile?.id;

        let tracksRestored = 0;
        let tracksMadePublic = 0;

        if (profileId) {
            // 2. Restore soft-deleted tracks on this profile
            const deletedTracks = await db.track.findMany({
                where: { profileId, deletedAt: { not: null } },
                select: { id: true },
            });
            if (deletedTracks.length) {
                await db.track.updateMany({ where: { id: { in: deletedTracks.map(t => t.id) } }, data: { deletedAt: null } });
                tracksRestored = deletedTracks.length;
            }

            // 3. Make all tracks public
            const privateTracks = await db.track.findMany({
                where: { profileId, isPublic: false },
                select: { id: true },
            });
            if (privateTracks.length) {
                await db.track.updateMany({ where: { id: { in: privateTracks.map(t => t.id) } }, data: { isPublic: true } });
                tracksMadePublic = privateTracks.length;
            }
        }

        res.json({
            ok: true,
            profileRestored: !!profile,
            tracksRestored,
            tracksMadePublic,
            profileId,
        });
    } catch (e: any) {
        logger.error('Profile repair failed', e);
        res.status(500).json({ error: e.message });
    }
});

// -- Batch MP3 re-transcode: generate mp3Url for all tracks missing it --------
// Runs in the background; returns immediately with a job count.
app.post('/api/admin/retranscode-mp3', requireAdmin, async (_req: any, res) => {
    try {
        const tracks = await db.track.findMany({
            where: { mp3Url: null, NOT: { url: '' } },
            select: { id: true, url: true },
        });
        res.json({ queued: tracks.length });

        // Process sequentially in the background to avoid overwhelming the server
        setImmediate(async () => {
            let done = 0, failed = 0;
            const tmpDir = path.join(process.cwd(), 'uploads', 'tmp', 'mp3-retranscode');
            fs.mkdirSync(tmpDir, { recursive: true });

            for (const track of tracks) {
                let tmpOggPath: string | null = null;
                try {
                    let oggPath: string;

                    if (track.url.startsWith('http')) {
                        // Download from CDN/R2 to a temp file
                        const ext = path.extname(new URL(track.url).pathname) || '.ogg';
                        tmpOggPath = path.join(tmpDir, `${track.id}${ext}`);
                        const response = await axios.get(track.url, { responseType: 'arraybuffer', timeout: 60_000 });
                        fs.writeFileSync(tmpOggPath, Buffer.from(response.data));
                        oggPath = tmpOggPath;
                    } else {
                        oggPath = path.join(process.cwd(), 'public', track.url);
                        if (!fs.existsSync(oggPath)) { failed++; continue; }
                    }

                    const mp3Path = await MediaConverter.convertToMp3(oggPath);
                    const r2Key = `tracks/${track.id}/audio/${path.basename(mp3Path)}`;
                    const localMp3Url = `/uploads/tracks/${path.basename(mp3Path)}`;
                    const mp3Url = await uploadToR2OrLocal(mp3Path, r2Key, 'audio/mpeg', localMp3Url);
                    await db.track.update({ where: { id: track.id }, data: { mp3Url } });

                    // Clean up temp OGG download and converted MP3 if it was stored locally
                    if (tmpOggPath && fs.existsSync(tmpOggPath)) fs.unlinkSync(tmpOggPath);
                    // If mp3Path differs from the final url (i.e. was uploaded to R2), remove local copy
                    if (mp3Url !== localMp3Url && fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);

                    done++;
                    if (done % 10 === 0) logger.info(`[RetranscodeMp3] Progress: ${done}/${tracks.length}`);
                } catch (e: any) {
                    logger.warn(`[RetranscodeMp3] Failed for track ${track.id}: ${e.message}`);
                    if (tmpOggPath && fs.existsSync(tmpOggPath)) { try { fs.unlinkSync(tmpOggPath); } catch {} }
                    failed++;
                }
            }
            logger.info(`[RetranscodeMp3] Complete — ${done} succeeded, ${failed} failed`);
        });
    } catch (e: any) {
        logger.error('Retranscode MP3 job failed', e);
        res.status(500).json({ error: 'Failed to start retranscode job' });
    }
});

// -- Manual Backup Trigger (admin only) --------------------------------------
app.post('/api/admin/backup', requireAdmin, async (_req: any, res) => {
    try {
        if (!R2Storage.isConfigured()) {
            return res.status(503).json({ error: 'R2 not configured' });
        }
        const result = await runBackup();
        res.json({ success: true, key: result.key, sizeMB: +(result.sizeBytes / 1024 / 1024).toFixed(2) });
    } catch (e: any) {
        logger.error('Manual backup failed', e);
        res.status(500).json({ error: 'Backup failed' });
    }
});

// -- Download a fresh pg_dump directly (admin only) ---------------------------
app.get('/api/admin/backup/download', requireAdmin, async (_req: any, res) => {
    try {
        logger.info('[Backup] Manual download initiated');
        const buffer = await pgDump();
        const stamp = new Date().toISOString().replace(/[T:]/g, '-').replace(/\..+$/, '');
        const filename = `fuji-backup-${stamp}.sql.gz`;

        // Track last manual download time
        manualBackupLastAt = Date.now();
        _saveBackupStamps();

        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-store');
        res.send(buffer);
        logger.info(`[Backup] Download served: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    } catch (e: any) {
        logger.error('[Backup] Download failed', e);
        res.status(500).json({ error: 'Backup generation failed. Check that pg_dump is installed on the server.' });
    }
});

// -- Backup status (for dashboard reminder) ------------------------------------
app.get('/api/admin/backup/status', requireAdmin, async (_req: any, res) => {
    res.json({
        r2Configured: R2Storage.isConfigured(),
        lastManualDownloadAt: manualBackupLastAt ? new Date(manualBackupLastAt).toISOString() : null,
        lastScheduledAt: scheduledBackupLastAt ? new Date(scheduledBackupLastAt).toISOString() : null,
    });
});

// -- Page Embeds (OG / social embed metadata per URL path) ---------------------

app.get('/api/admin/page-embeds', requireAdmin, async (_req, res) => {
    try {
        const embeds = await db.pageEmbed.findMany({ orderBy: { path: 'asc' } });
        res.json(embeds);
    } catch (e) {
        logger.error('GET /api/admin/page-embeds error', e);
        res.status(500).json({ error: 'Failed to fetch page embeds' });
    }
});

app.put('/api/admin/page-embeds', requireAdmin, async (req: any, res) => {
    try {
        const { path: p, title, description, imageUrl } = req.body;
        if (!p?.trim() || !title?.trim()) return res.status(400).json({ error: 'path and title are required' });
        const embed = await db.pageEmbed.upsert({
            where: { path: p.trim() },
            create: { path: p.trim(), title: title.trim(), description: description?.trim() ?? '', imageUrl: imageUrl?.trim() || null },
            update: { title: title.trim(), description: description?.trim() ?? '', imageUrl: imageUrl?.trim() || null },
        });
        res.json(embed);
    } catch (e) {
        logger.error('PUT /api/admin/page-embeds error', e);
        res.status(500).json({ error: 'Failed to save page embed' });
    }
});

app.delete('/api/admin/page-embeds/:path(*)', requireAdmin, async (req: any, res) => {
    try {
        const p = '/' + req.params.path;
        await db.pageEmbed.delete({ where: { path: p } });
        res.json({ ok: true });
    } catch {
        res.json({ ok: true }); // already gone
    }
});

// -- Booster Colour Roles ------------------------------------------------------

app.get('/api/booster-color/settings/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'booster-color')) return res.status(403).json({ error: 'Forbidden' });

        const settings = await db.boosterColorSettings.findUnique({ where: { guildId } });
        res.json(settings || { boosterRoleId: null, colorRoleIds: [] });
    } catch (e) {
        logger.error('Failed to get booster-color settings', e);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

app.post('/api/booster-color/settings/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'booster-color')) return res.status(403).json({ error: 'Forbidden' });

        const { boosterRoleId, colorRoleIds } = req.body;
        const settings = await db.boosterColorSettings.upsert({
            where: { guildId },
            update: { boosterRoleId: boosterRoleId || null, colorRoleIds: colorRoleIds || [] },
            create: { guildId, boosterRoleId: boosterRoleId || null, colorRoleIds: colorRoleIds || [] },
        });
        res.json(settings);
    } catch (e) {
        logger.error('Failed to save booster-color settings', e);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// ---------------------------------------------------------------------------
// PRIVATE MESSAGING � Encrypted 1:1 & Group Chats
// ---------------------------------------------------------------------------
const msgEnc = new MessageEncryption();

// Search users to start a conversation with
app.get('/api/messages/search-users', requireAuth, async (req: any, res) => {
    try {
        const q = (req.query.q as string || '').trim();
        if (q.length < 2) return res.json([]);
        const me = req.session.user.id;
        const profiles = await db.musicianProfile.findMany({
            where: {
                deletedAt: null,
                status: 'active',
                userId: { not: me },
                OR: [
                    { username: { contains: q, mode: 'insensitive' } },
                    { displayName: { contains: q, mode: 'insensitive' } },
                ],
            },
            select: { userId: true, username: true, displayName: true, avatar: true },
            take: 15,
        });
        res.json(profiles);
    } catch (e) {
        logger.error('Message user search', e);
        res.status(500).json({ error: 'Search failed' });
    }
});

// List my conversations
app.get('/api/messages/conversations', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const showArchived = req.query.archived === 'true';
        const participations = await db.conversationParticipant.findMany({
            where: { userId: me, archived: showArchived },
            include: {
                conversation: {
                    include: {
                        participants: true,
                        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                    },
                },
            },
        });
        const convos = await Promise.all(participations.map(async (p) => {
            const conv = p.conversation;
            const otherIds = conv.participants.filter(pp => pp.userId !== me).map(pp => pp.userId);
            const others = await Promise.all(otherIds.map(async (uid) => {
                const profile = await db.musicianProfile.findUnique({
                    where: { userId: uid },
                    select: { userId: true, username: true, displayName: true, avatar: true },
                });
                if (profile) return profile;
                const resolved = await resolveUser(uid);
                return { userId: uid, username: resolved?.username || 'Unknown', displayName: null, avatar: resolved?.avatar || null };
            }));
            let lastMessagePreview: string | null = null;
            let lastMessageAt: string | null = null;
            let lastMessageSenderId: string | null = null;
            if (conv.messages.length > 0) {
                const msg = conv.messages[0];
                lastMessageAt = msg.createdAt.toISOString();
                lastMessageSenderId = msg.senderId;
                if (!msg.deleted) {
                    try { lastMessagePreview = msgEnc.decrypt(msg.encryptedContent, msg.iv, conv.encryptedKey); } catch { lastMessagePreview = '[encrypted]'; }
                    if (lastMessagePreview && lastMessagePreview.length > 80) lastMessagePreview = lastMessagePreview.slice(0, 80) + '�';
                } else {
                    lastMessagePreview = '[deleted]';
                }
            }
            const unread = await db.privateMessage.count({
                where: { conversationId: conv.id, createdAt: { gt: p.lastReadAt }, senderId: { not: me }, deleted: false },
            });
            return {
                id: conv.id,
                name: conv.name,
                isGroup: conv.isGroup,
                participants: others,
                lastMessagePreview,
                lastMessageAt,
                lastMessageSenderId,
                unread,
                muted: p.muted,
                archived: p.archived,
                createdAt: conv.createdAt.toISOString(),
            };
        }));
        convos.sort((a, b) => {
            const tA = a.lastMessageAt || a.createdAt;
            const tB = b.lastMessageAt || b.createdAt;
            return new Date(tB).getTime() - new Date(tA).getTime();
        });
        res.json(convos);
    } catch (e) {
        logger.error('List conversations', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Create conversation (1:1 or group)
app.post('/api/messages/conversations', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const { participantIds, name, isGroup } = req.body;
        if (!Array.isArray(participantIds) || participantIds.length === 0) return res.status(400).json({ error: 'participantIds required' });
        // Sanitize � remove self, deduplicate
        const uniqueIds = [...new Set(participantIds.filter((id: string) => id !== me))] as string[];
        if (uniqueIds.length === 0) return res.status(400).json({ error: 'Need at least one other participant' });
        // Verify all participant IDs are real users
        const validUsers = await db.musicianProfile.findMany({ where: { userId: { in: uniqueIds } }, select: { userId: true } });
        if (validUsers.length !== uniqueIds.length) return res.status(400).json({ error: 'One or more participant IDs are invalid' });
        // For 1:1, check if conversation already exists
        if (!isGroup && uniqueIds.length === 1) {
            const existing = await db.conversation.findFirst({
                where: {
                    isGroup: false,
                    participants: { every: { userId: { in: [me, uniqueIds[0]] } } },
                    AND: [
                        { participants: { some: { userId: me } } },
                        { participants: { some: { userId: uniqueIds[0] } } },
                    ],
                },
                include: { participants: true },
            });
            if (existing && existing.participants.length === 2) {
                return res.json({ id: existing.id, existing: true });
            }
        }
        const allIds = [me, ...uniqueIds];
        const conv = await db.conversation.create({
            data: {
                name: isGroup ? (name || 'Group Chat') : null,
                isGroup: isGroup || false,
                createdById: me,
                encryptedKey: msgEnc.generateConversationKey(),
                participants: {
                    create: allIds.map(uid => ({ userId: uid })),
                },
            },
            include: { participants: true },
        });
        res.json({ id: conv.id, existing: false });
    } catch (e) {
        logger.error('Create conversation', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Get messages (cursor-based pagination)
app.get('/api/messages/conversations/:id/messages', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const convId = req.params.id;
        // Verify participant
        const participant = await db.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId: convId, userId: me } },
        });
        if (!participant) return res.status(403).json({ error: 'Not a participant' });
        const conv = await db.conversation.findUnique({ where: { id: convId } });
        if (!conv) return res.status(404).json({ error: 'Not found' });
        const cursor = req.query.before as string | undefined;
        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const messages = await db.privateMessage.findMany({
            where: { conversationId: convId, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        const decrypted = messages.map(m => ({
            id: m.id,
            senderId: m.senderId,
            content: m.deleted ? null : (() => { try { return msgEnc.decrypt(m.encryptedContent, m.iv, conv.encryptedKey); } catch { return '[decryption error]'; } })(),
            deleted: m.deleted,
            createdAt: m.createdAt.toISOString(),
            editedAt: m.editedAt?.toISOString() || null,
        }));
        res.json(decrypted.reverse()); // Return oldest-first for display
    } catch (e) {
        logger.error('Get messages', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Send message
app.post('/api/messages/conversations/:id/messages', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const convId = req.params.id;
        const { content } = req.body;
        if (!content || typeof content !== 'string' || content.trim().length === 0) return res.status(400).json({ error: 'Message content required' });
        if (content.length > 4000) return res.status(400).json({ error: 'Message too long (max 4000 chars)' });
        const participant = await db.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId: convId, userId: me } },
        });
        if (!participant) return res.status(403).json({ error: 'Not a participant' });
        const conv = await db.conversation.findUnique({ where: { id: convId } });
        if (!conv) return res.status(404).json({ error: 'Not found' });
        const { ciphertext, iv } = msgEnc.encrypt(content.trim(), conv.encryptedKey);
        const msg = await db.privateMessage.create({
            data: { conversationId: convId, senderId: me, encryptedContent: ciphertext, iv },
        });
        // Update conversation timestamp
        await db.conversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });
        // Mark sender's own read cursor
        await db.conversationParticipant.update({
            where: { conversationId_userId: { conversationId: convId, userId: me } },
            data: { lastReadAt: new Date() },
        });
        // Unarchive conversation for all participants when a new message arrives
        await db.conversationParticipant.updateMany({
            where: { conversationId: convId, archived: true },
            data: { archived: false },
        });
        res.json({ id: msg.id, senderId: me, content: content.trim(), deleted: false, createdAt: msg.createdAt.toISOString(), editedAt: null });
    } catch (e) {
        logger.error('Send message', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Delete own message
app.delete('/api/messages/conversations/:convId/messages/:msgId', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const { convId, msgId } = req.params;
        const participant = await db.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId: convId, userId: me } },
        });
        if (!participant) return res.status(403).json({ error: 'Not a participant' });
        const msg = await db.privateMessage.findUnique({ where: { id: msgId } });
        if (!msg || msg.conversationId !== convId) return res.status(404).json({ error: 'Not found' });
        if (msg.senderId !== me) return res.status(403).json({ error: 'Can only delete your own messages' });
        await db.privateMessage.update({ where: { id: msgId }, data: { deleted: true } });
        res.json({ success: true });
    } catch (e) {
        logger.error('Delete message', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Mark conversation as read
app.put('/api/messages/conversations/:id/read', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const participant = await db.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
        });
        if (!participant) return res.status(403).json({ error: 'Not a participant' });
        await db.conversationParticipant.update({
            where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
            data: { lastReadAt: new Date() },
        });
        res.json({ success: true });
    } catch (e) {
        logger.error('Mark read', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Get total unread count (for badge)
app.get('/api/messages/unread', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const participations = await db.conversationParticipant.findMany({ where: { userId: me, muted: false, archived: false } });
        let total = 0;
        for (const p of participations) {
            const count = await db.privateMessage.count({
                where: { conversationId: p.conversationId, createdAt: { gt: p.lastReadAt }, senderId: { not: me }, deleted: false },
            });
            if (count > 0) total++;
        }
        res.json({ unread: total });
    } catch (e) {
        logger.error('Unread count', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Update conversation (rename group, mute/unmute)
app.patch('/api/messages/conversations/:id', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const convId = req.params.id;
        const participant = await db.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId: convId, userId: me } },
        });
        if (!participant) return res.status(403).json({ error: 'Not a participant' });
        const { name, muted } = req.body;
        if (name !== undefined) {
            const conv = await db.conversation.findUnique({ where: { id: convId } });
            if (conv?.isGroup) await db.conversation.update({ where: { id: convId }, data: { name } });
        }
        if (muted !== undefined) {
            await db.conversationParticipant.update({
                where: { conversationId_userId: { conversationId: convId, userId: me } },
                data: { muted },
            });
        }
        const { archived } = req.body;
        if (archived !== undefined) {
            await db.conversationParticipant.update({
                where: { conversationId_userId: { conversationId: convId, userId: me } },
                data: { archived: !!archived },
            });
        }
        res.json({ success: true });
    } catch (e) {
        logger.error('Update conversation', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Add participants to a group chat
app.post('/api/messages/conversations/:id/participants', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const convId = req.params.id;
        const { userIds } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ error: 'userIds required' });
        const conv = await db.conversation.findUnique({ where: { id: convId }, include: { participants: true } });
        if (!conv) return res.status(404).json({ error: 'Not found' });
        if (!conv.isGroup) return res.status(400).json({ error: 'Cannot add participants to a 1:1 chat' });
        if (!conv.participants.some(p => p.userId === me)) return res.status(403).json({ error: 'Not a participant' });
        const existing = new Set(conv.participants.map(p => p.userId));
        const newIds = userIds.filter((id: string) => !existing.has(id));
        // Verify new user IDs are real users
        if (newIds.length > 0) {
            const validUsers = await db.musicianProfile.findMany({ where: { userId: { in: newIds } }, select: { userId: true } });
            if (validUsers.length !== newIds.length) return res.status(400).json({ error: 'One or more user IDs are invalid' });
        }
        if (newIds.length > 0) {
            await db.conversationParticipant.createMany({
                data: newIds.map((uid: string) => ({ conversationId: convId, userId: uid })),
                skipDuplicates: true,
            });
        }
        res.json({ added: newIds.length });
    } catch (e) {
        logger.error('Add participants', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Leave a group conversation
app.delete('/api/messages/conversations/:id/leave', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const convId = req.params.id;
        const conv = await db.conversation.findUnique({ where: { id: convId }, include: { participants: true } });
        if (!conv) return res.status(404).json({ error: 'Not found' });
        if (!conv.isGroup) return res.status(400).json({ error: 'Cannot leave a 1:1 chat' });
        await db.conversationParticipant.delete({
            where: { conversationId_userId: { conversationId: convId, userId: me } },
        });
        // If no participants remain, delete conversation
        const remaining = await db.conversationParticipant.count({ where: { conversationId: convId } });
        if (remaining === 0) await db.conversation.delete({ where: { id: convId } });
        res.json({ success: true });
    } catch (e) {
        logger.error('Leave conversation', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Get conversation details (participants, metadata)
app.get('/api/messages/conversations/:id', requireAuth, async (req: any, res) => {
    try {
        const me = req.session.user.id;
        const convId = req.params.id;
        const participant = await db.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId: convId, userId: me } },
        });
        if (!participant) return res.status(403).json({ error: 'Not a participant' });
        const conv = await db.conversation.findUnique({ where: { id: convId }, include: { participants: true } });
        if (!conv) return res.status(404).json({ error: 'Not found' });
        const enriched = await Promise.all(conv.participants.map(async (p) => {
            const profile = await db.musicianProfile.findUnique({
                where: { userId: p.userId },
                select: { userId: true, username: true, displayName: true, avatar: true },
            });
            if (profile) return { ...profile, joinedAt: p.joinedAt };
            const resolved = await resolveUser(p.userId);
            return { userId: p.userId, username: resolved?.username || 'Unknown', displayName: null, avatar: resolved?.avatar || null, joinedAt: p.joinedAt };
        }));
        res.json({ id: conv.id, name: conv.name, isGroup: conv.isGroup, createdById: conv.createdById, createdAt: conv.createdAt, participants: enriched });
    } catch (e) {
        logger.error('Get conversation', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// ---------------------------------------------------------------------------
// ADMIN � Private Messaging Dashboard
// ---------------------------------------------------------------------------

// Admin: list all conversations with stats
app.get('/api/admin/messages/conversations', requireAdmin, async (_req: any, res) => {
    try {
        const conversations = await db.conversation.findMany({
            include: {
                participants: true,
                messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                _count: { select: { messages: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 200,
        });
        const result = await Promise.all(conversations.map(async (conv) => {
            const participantProfiles = await Promise.all(conv.participants.map(async (p) => {
                const profile = await db.musicianProfile.findUnique({
                    where: { userId: p.userId },
                    select: { userId: true, username: true, displayName: true, avatar: true },
                });
                return profile || { userId: p.userId, username: 'Unknown', displayName: null, avatar: null };
            }));
            let lastMessagePreview: string | null = null;
            let lastMessageAt: string | null = null;
            if (conv.messages.length > 0) {
                const msg = conv.messages[0];
                lastMessageAt = msg.createdAt.toISOString();
                if (!msg.deleted) {
                    try { lastMessagePreview = msgEnc.decrypt(msg.encryptedContent, msg.iv, conv.encryptedKey); } catch { lastMessagePreview = '[encrypted]'; }
                    if (lastMessagePreview && lastMessagePreview.length > 100) lastMessagePreview = lastMessagePreview.slice(0, 100) + '�';
                } else {
                    lastMessagePreview = '[deleted]';
                }
            }
            return {
                id: conv.id,
                name: conv.name,
                isGroup: conv.isGroup,
                createdById: conv.createdById,
                createdAt: conv.createdAt.toISOString(),
                updatedAt: conv.updatedAt.toISOString(),
                messageCount: conv._count.messages,
                participantCount: conv.participants.length,
                participants: participantProfiles,
                lastMessagePreview,
                lastMessageAt,
            };
        }));
        res.json(result);
    } catch (e) {
        logger.error('Admin list conversations', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Admin: get messages for a conversation
app.get('/api/admin/messages/conversations/:id/messages', requireAdmin, async (req: any, res) => {
    try {
        const convId = req.params.id;
        const conv = await db.conversation.findUnique({ where: { id: convId } });
        if (!conv) return res.status(404).json({ error: 'Not found' });
        const messages = await db.privateMessage.findMany({
            where: { conversationId: convId },
            orderBy: { createdAt: 'asc' },
            take: 200,
        });
        const decrypted = messages.map(m => ({
            id: m.id,
            senderId: m.senderId,
            content: m.deleted ? null : (() => { try { return msgEnc.decrypt(m.encryptedContent, m.iv, conv.encryptedKey); } catch { return '[decryption error]'; } })(),
            deleted: m.deleted,
            createdAt: m.createdAt.toISOString(),
        }));
        const senderIds = [...new Set(messages.map(m => m.senderId))];
        const senderProfiles = await db.musicianProfile.findMany({
            where: { userId: { in: senderIds } },
            select: { userId: true, username: true, displayName: true, avatar: true },
        });
        const senderMap: Record<string, any> = {};
        senderProfiles.forEach(p => { senderMap[p.userId] = p; });
        res.json({ messages: decrypted, senders: senderMap });
    } catch (e) {
        logger.error('Admin get messages', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Admin: delete a conversation entirely
app.delete('/api/admin/messages/conversations/:id', requireAdmin, async (req: any, res) => {
    try {
        const convId = req.params.id;
        const conv = await db.conversation.findUnique({ where: { id: convId } });
        if (!conv) return res.status(404).json({ error: 'Not found' });
        await db.conversation.delete({ where: { id: convId } });
        res.json({ success: true });
    } catch (e) {
        logger.error('Admin delete conversation', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Admin: delete a specific message
app.delete('/api/admin/messages/conversations/:convId/messages/:msgId', requireAdmin, async (req: any, res) => {
    try {
        const { convId, msgId } = req.params;
        const msg = await db.privateMessage.findUnique({ where: { id: msgId } });
        if (!msg || msg.conversationId !== convId) return res.status(404).json({ error: 'Not found' });
        await db.privateMessage.update({ where: { id: msgId }, data: { deleted: true } });
        res.json({ success: true });
    } catch (e) {
        logger.error('Admin delete message', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// Admin: messaging stats
app.get('/api/admin/messages/stats', requireAdmin, async (_req: any, res) => {
    try {
        const [totalConversations, totalMessages, activeUsers, last24hMessages] = await Promise.all([
            db.conversation.count(),
            db.privateMessage.count(),
            db.conversationParticipant.groupBy({ by: ['userId'], _count: true }).then(r => r.length),
            db.privateMessage.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
        ]);
        res.json({ totalConversations, totalMessages, activeUsers, last24hMessages });
    } catch (e) {
        logger.error('Admin messaging stats', e);
        res.status(500).json({ error: 'Failed' });
    }
});

// -- Server Boost Settings ----------------------------------------------------

app.get('/api/server-boost/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const settings = await db.serverBoostSettings.findUnique({ where: { guildId } });
        res.json(settings || { guildId, enabled: true, announcementChannelId: null, messageText: null, embedJson: null, reactionEmoji: null, rewardRoleId: null });
    } catch (e) {
        logger.error('GET server-boost settings', e);
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

app.put('/api/server-boost/:guildId', async (req: any, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { guildId } = req.params;
    if (!hasDashboardAccess(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
    const { enabled, announcementChannelId, messageText, embedJson, reactionEmoji, rewardRoleId } = req.body;
    try {
        const settings = await db.serverBoostSettings.upsert({
            where: { guildId },
            create: {
                guildId,
                enabled: enabled !== undefined ? !!enabled : true,
                announcementChannelId: announcementChannelId || null,
                messageText: messageText || null,
                embedJson: embedJson !== undefined ? (embedJson ? JSON.stringify(embedJson) : null) : null,
                reactionEmoji: reactionEmoji || null,
                rewardRoleId: rewardRoleId || null,
            },
            update: {
                ...(enabled !== undefined && { enabled: !!enabled }),
                ...(announcementChannelId !== undefined && { announcementChannelId: announcementChannelId || null }),
                ...(messageText !== undefined && { messageText: messageText || null }),
                ...(embedJson !== undefined && { embedJson: embedJson ? JSON.stringify(embedJson) : null }),
                ...(reactionEmoji !== undefined && { reactionEmoji: reactionEmoji || null }),
                ...(rewardRoleId !== undefined && { rewardRoleId: rewardRoleId || null }),
            },
        });
        res.json(settings);
    } catch (e) {
        logger.error('PUT server-boost settings', e);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// ---------------------------------------------------------------
//  REPORTS (user-submitted content reports)
// ---------------------------------------------------------------

// Submit a report (any authenticated user)
app.post('/api/reports', async (req: any, res) => {
    try {
        const user = req.session?.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { targetType, targetId, reason, details } = req.body;
        if (!targetType || !targetId || !reason) {
            return res.status(400).json({ error: 'targetType, targetId, and reason are required' });
        }
        const validTypes = ['track', 'profile', 'comment', 'message'];
        const validReasons = ['spam', 'harassment', 'copyright', 'nsfw', 'scam', 'other'];
        if (!validTypes.includes(targetType)) return res.status(400).json({ error: 'Invalid targetType' });
        if (!validReasons.includes(reason)) return res.status(400).json({ error: 'Invalid reason' });

        // Rate limit: max 10 open reports per user
        const openCount = await db.report.count({ where: { reporterUserId: user.id, status: 'open' } });
        if (openCount >= 10) return res.status(429).json({ error: 'Too many open reports. Please wait for existing reports to be reviewed.' });

        // Prevent duplicate reports on the same target
        const existing = await db.report.findFirst({
            where: { reporterUserId: user.id, targetType, targetId, status: { in: ['open', 'reviewing'] } }
        });
        if (existing) return res.status(409).json({ error: 'You have already reported this content.' });

        // Build content snapshot & find reported user
        let reportedUserId = 'unknown';
        let reportedName = 'Unknown User';
        let contentSnapshot: any = {};

        if (targetType === 'track') {
            const track = await db.track.findUnique({
                where: { id: targetId },
                include: { profile: { select: { userId: true, username: true, displayName: true } } }
            });
            if (!track) return res.status(404).json({ error: 'Track not found' });
            reportedUserId = track.profile.userId;
            reportedName = track.profile.displayName || track.profile.username;
            contentSnapshot = { title: track.title, artist: track.artist, description: track.description, url: track.url, coverUrl: track.coverUrl, slug: track.slug, profileUsername: track.profile.username };
        } else if (targetType === 'profile') {
            const profile = await db.musicianProfile.findUnique({ where: { id: targetId } });
            if (!profile) return res.status(404).json({ error: 'Profile not found' });
            reportedUserId = profile.userId;
            reportedName = profile.displayName || profile.username;
            contentSnapshot = { username: profile.username, displayName: profile.displayName, bio: profile.bio, avatar: profile.avatar };
        } else if (targetType === 'comment') {
            const comment = await db.comment.findUnique({ where: { id: targetId } });
            if (!comment) return res.status(404).json({ error: 'Comment not found' });
            reportedUserId = comment.userId;
            reportedName = comment.username;
            contentSnapshot = { content: comment.content, gifUrl: comment.gifUrl, trackId: comment.trackId, profileId: comment.profileId };
        } else if (targetType === 'message') {
            const message = await db.privateMessage.findUnique({ where: { id: targetId } });
            if (!message) return res.status(404).json({ error: 'Message not found' });
            reportedUserId = message.senderId;
            // Try to get sender display name
            const senderProfile = await db.musicianProfile.findUnique({ where: { userId: message.senderId } });
            reportedName = senderProfile?.displayName || senderProfile?.username || message.senderId;
            contentSnapshot = { encryptedContent: message.encryptedContent, iv: message.iv, conversationId: message.conversationId };
        }

        // Don't allow self-reports
        if (reportedUserId === user.id) return res.status(400).json({ error: 'You cannot report your own content.' });

        const report = await db.report.create({
            data: {
                reporterUserId: user.id,
                reporterName: user.global_name || user.username || user.id,
                targetType,
                targetId,
                reportedUserId,
                reportedName,
                reason,
                details: details?.slice(0, 2000) || null,
                contentSnapshot: JSON.stringify(contentSnapshot),
            }
        });

        res.status(201).json({ id: report.id, message: 'Report submitted. Our team will review it shortly.' });
    } catch (e: any) {
        logger.error('POST /api/reports error', e);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

// ── Bug Reports ───────────────────────────────────────────────────────────────

const bugReportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    keyGenerator: (req: any) => req.session?.user?.id || req.ip,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'You can submit at most 3 bug reports per hour. Please wait before trying again.' },
});

const bugReportUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB max for screenshots

app.post('/api/bug-reports', requireAuth, bugReportLimiter, bugReportUpload.single('screenshot'), async (req: any, res) => {
    try {
        const userId   = req.session.user.id;
        const username = req.session.user.global_name || req.session.user.username || userId;

        const { pageUrl, description, errors, userAgent, viewport } = req.body;
        if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
        if (!pageUrl)             return res.status(400).json({ error: 'pageUrl is required' });

        // Hard rate-limit: also enforce in DB so it survives restarts
        const since = new Date(Date.now() - 60 * 60 * 1000);
        const recentCount = await db.bugReport.count({ where: { userId, createdAt: { gte: since } } });
        if (recentCount >= 3) return res.status(429).json({ error: 'You can submit at most 3 bug reports per hour.' });

        let screenshotUrl: string | null = null;
        if (req.file) {
            try {
                if (R2Storage.isConfigured()) {
                    const key = `bug-reports/${userId}/${Date.now()}-screenshot.jpg`;
                    screenshotUrl = await R2Storage.uploadBuffer(key, req.file.buffer, 'image/jpeg');
                }
            } catch { /* non-fatal — skip screenshot if R2 unavailable */ }
        }

        let parsedErrors: any = null;
        try { parsedErrors = errors ? JSON.parse(errors) : null; } catch { /* ignore */ }

        const report = await db.bugReport.create({
            data: {
                userId,
                username,
                pageUrl: String(pageUrl).slice(0, 2000),
                description: String(description).trim().slice(0, 5000),
                errors: parsedErrors,
                userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
                viewport: viewport ? String(viewport).slice(0, 50) : null,
                screenshotUrl,
            },
        });

        logger.info(`[BugReport] ${username} filed report ${report.id} for ${pageUrl}`);
        res.json({ id: report.id });
    } catch (e: any) {
        logger.error('POST /api/bug-reports error', e);
        res.status(500).json({ error: 'Failed to submit bug report' });
    }
});

// Admin: list bug reports
app.get('/api/admin/bug-reports', requireAdmin, async (req: any, res) => {
    try {
        const { status, page = '1', limit = '50' } = req.query;
        const where: any = {};
        if (status) where.status = status;
        const take = Math.min(parseInt(limit as string) || 50, 100);
        const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;
        const [reports, total] = await Promise.all([
            db.bugReport.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
            db.bugReport.count({ where }),
        ]);
        res.json({ reports, total, pages: Math.ceil(total / take) });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: update bug report status
app.patch('/api/admin/bug-reports/:id', requireAdmin, async (req: any, res) => {
    try {
        const admin = req.session.user;
        const { status, resolutionNote } = req.body;
        const validStatuses = ['open', 'investigating', 'resolved', 'closed'];
        if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
        const report = await db.bugReport.update({
            where: { id: req.params.id },
            data: {
                status,
                resolutionNote: resolutionNote?.slice(0, 2000) || null,
                ...(['resolved', 'closed'].includes(status) ? {
                    resolvedByUserId: admin.id,
                    resolvedByName: admin.global_name || admin.username,
                    resolvedAt: new Date(),
                } : {}),
            },
        });
        res.json(report);
    } catch (e: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: List all reports (with filters)
app.get('/api/admin/reports', requireAdmin, async (req: any, res) => {
    try {
        const { status, targetType, page = '1', limit = '50' } = req.query;
        const where: any = {};
        if (status) where.status = status;
        if (targetType) where.targetType = targetType;

        const take = Math.min(parseInt(limit) || 50, 100);
        const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

        const [reports, total] = await Promise.all([
            db.report.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
            db.report.count({ where }),
        ]);

        res.json({ reports, total, page: parseInt(page) || 1, pages: Math.ceil(total / take) });
    } catch (e: any) {
        logger.error('GET /api/admin/reports error', e);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// Admin: Get single report details
app.get('/api/admin/reports/:reportId', requireAdmin, async (req: any, res) => {
    try {
        const report = await db.report.findUnique({ where: { id: req.params.reportId } });
        if (!report) return res.status(404).json({ error: 'Report not found' });
        res.json(report);
    } catch (e: any) {
        logger.error('GET /api/admin/reports/:id error', e);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Admin: Update report status (resolve/dismiss)
app.patch('/api/admin/reports/:reportId', requireAdmin, async (req: any, res) => {
    try {
        const user = req.session?.user;
        const { status, resolutionNote } = req.body;
        const validStatuses = ['open', 'reviewing', 'resolved', 'dismissed'];
        if (!status || !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        const report = await db.report.findUnique({ where: { id: req.params.reportId } });
        if (!report) return res.status(404).json({ error: 'Report not found' });

        const updated = await db.report.update({
            where: { id: req.params.reportId },
            data: {
                status,
                resolutionNote: resolutionNote?.slice(0, 2000) || null,
                ...(status === 'resolved' || status === 'dismissed' ? {
                    resolvedByUserId: user.id,
                    resolvedByName: user.global_name || user.username || user.id,
                    resolvedAt: new Date(),
                } : {}),
            }
        });

        res.json(updated);
    } catch (e: any) {
        logger.error('PATCH /api/admin/reports/:id error', e);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

// -------------------------------------------------------------------------------
// ��  ARTICLES / NEWS PLUGIN ENDPOINTS
// -------------------------------------------------------------------------------

// Helper: generate URL-safe slug from title
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

// -- Public: Get published articles (paginated) --------------------------------
app.get('/api/articles', async (req: any, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
        const category = req.query.category as string;
        const featured = req.query.featured === 'true';
        const skip = (page - 1) * limit;

        const where: any = { status: 'published' };
        if (category) where.category = category;
        if (featured) where.isFeatured = true;

        const [articles, total] = await Promise.all([
            db.article.findMany({
                where,
                orderBy: { publishedAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true, slug: true, title: true, subtitle: true, excerpt: true,
                    coverImageUrl: true, authorUserId: true, authorName: true, authorAvatar: true,
                    category: true, tags: true, isFeatured: true, publishedAt: true,
                    viewCount: true, createdAt: true,
                },
            }),
            db.article.count({ where }),
        ]);

        res.json({ articles, total, page, totalPages: Math.ceil(total / limit) });
    } catch (e: any) {
        logger.error('GET /api/articles error', e);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});

// -- Public: Get single article by slug ----------------------------------------
app.get('/api/articles/:slug', async (req: any, res) => {
    try {
        const article = await db.article.findUnique({
            where: { slug: req.params.slug },
        });
        if (!article || article.status !== 'published') {
            return res.status(404).json({ error: 'Article not found' });
        }
        // Increment view count (fire and forget)
        db.article.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
        res.json(article);
    } catch (e: any) {
        logger.error('GET /api/articles/:slug error', e);
        res.status(500).json({ error: 'Failed to fetch article' });
    }
});

// -------------------------------------------------------------------------------
// ��  WRITER ARTICLE ENDPOINTS (any authenticated user)
// -------------------------------------------------------------------------------

// -- Writer: List own articles -------------------------------------------------
app.get('/api/my/articles', requireAuth, async (req: any, res) => {
    try {
        const user = req.session.user;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
        const status = req.query.status as string;
        const skip = (page - 1) * limit;

        const where: any = { authorUserId: user.id };
        if (status) where.status = status;

        const [articles, total] = await Promise.all([
            db.article.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: limit }),
            db.article.count({ where }),
        ]);

        res.json({ articles, total, page, totalPages: Math.ceil(total / limit) });
    } catch (e: any) {
        logger.error('GET /api/my/articles error', e);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});

// -- Writer: Get own article by ID ---------------------------------------------
app.get('/api/my/articles/:id', requireAuth, async (req: any, res) => {
    try {
        const user = req.session.user;
        const article = await db.article.findUnique({ where: { id: req.params.id } });
        if (!article || article.authorUserId !== user.id) return res.status(404).json({ error: 'Article not found' });
        res.json(article);
    } catch (e: any) {
        logger.error('GET /api/my/articles/:id error', e);
        res.status(500).json({ error: 'Failed to fetch article' });
    }
});

// -- Writer: Create article (draft or submit for review) ----------------------
app.post('/api/my/articles', requireAuth, async (req: any, res) => {
    try {
        const user = req.session.user;
        const { title, subtitle, content, excerpt, coverImageUrl, category, tags, metaTitle, metaDescription, status } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

        let baseSlug = slugify(title);
        if (!baseSlug) baseSlug = 'article';
        let slug = baseSlug;
        let suffix = 1;
        while (await db.article.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${suffix++}`;
        }

        // Writers can only create as draft or pending � never published directly
        const articleStatus = status === 'pending' ? 'pending' : 'draft';

        // Use the first guild the bot + user share
        const guildObj = req.session?.mutualAdminGuilds?.[0] || req.session?.mutualStaffGuilds?.[0];
        const guildId = guildObj?.id;

        // Ensure guild row exists
        if (guildId) {
            await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: guildObj?.name || 'Unknown' } });
        }

        const article = await db.article.create({
            data: {
                guildId: guildId || 'default',
                slug,
                title: title.slice(0, 200),
                subtitle: subtitle?.slice(0, 300) || null,
                content,
                excerpt: excerpt?.slice(0, 500) || null,
                coverImageUrl: coverImageUrl || null,
                authorUserId: user.id,
                authorName: user.global_name || user.username || 'Writer',
                authorAvatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
                category: ['news', 'guide', 'announcement', 'tutorial'].includes(category) ? category : 'news',
                tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
                metaTitle: metaTitle?.slice(0, 120) || null,
                metaDescription: metaDescription?.slice(0, 300) || null,
                status: articleStatus,
            },
        });

        res.status(201).json(article);
    } catch (e: any) {
        logger.error('POST /api/my/articles error', e);
        res.status(500).json({ error: 'Failed to create article' });
    }
});

// -- Writer: Update own article (only if draft or rejected) -------------------
app.patch('/api/my/articles/:id', requireAuth, async (req: any, res) => {
    try {
        const user = req.session.user;
        const existing = await db.article.findUnique({ where: { id: req.params.id } });
        if (!existing || existing.authorUserId !== user.id) return res.status(404).json({ error: 'Article not found' });

        // Writers can only edit drafts or rejected articles
        if (!['draft', 'rejected'].includes(existing.status)) {
            return res.status(403).json({ error: 'You can only edit articles in draft or rejected status' });
        }

        const { title, subtitle, content, excerpt, coverImageUrl, category, tags, metaTitle, metaDescription, status } = req.body;
        const data: any = { updatedAt: new Date() };

        if (title !== undefined) data.title = title.slice(0, 200);
        if (subtitle !== undefined) data.subtitle = subtitle?.slice(0, 300) || null;
        if (content !== undefined) data.content = content;
        if (excerpt !== undefined) data.excerpt = excerpt?.slice(0, 500) || null;
        if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl || null;
        if (category && ['news', 'guide', 'announcement', 'tutorial'].includes(category)) data.category = category;
        if (tags !== undefined) data.tags = Array.isArray(tags) ? tags.slice(0, 10) : existing.tags;
        if (metaTitle !== undefined) data.metaTitle = metaTitle?.slice(0, 120) || null;
        if (metaDescription !== undefined) data.metaDescription = metaDescription?.slice(0, 300) || null;

        // Writers can re-submit for review or save as draft � never publish directly
        if (status === 'pending' || status === 'draft') {
            data.status = status;
            if (status === 'pending') {
                data.reviewNote = null;
                data.reviewedAt = null;
                data.reviewedByUserId = null;
                data.reviewedByName = null;
            }
        }

        const article = await db.article.update({ where: { id: req.params.id }, data });
        res.json(article);
    } catch (e: any) {
        logger.error('PATCH /api/my/articles/:id error', e);
        res.status(500).json({ error: 'Failed to update article' });
    }
});

// -- Writer: Delete own article (only drafts) ---------------------------------
app.delete('/api/my/articles/:id', requireAuth, async (req: any, res) => {
    try {
        const user = req.session.user;
        const existing = await db.article.findUnique({ where: { id: req.params.id } });
        if (!existing || existing.authorUserId !== user.id) return res.status(404).json({ error: 'Article not found' });
        if (existing.status !== 'draft') return res.status(403).json({ error: 'You can only delete draft articles' });

        await db.article.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        logger.error('DELETE /api/my/articles/:id error', e);
        res.status(500).json({ error: 'Failed to delete article' });
    }
});

// -- Writer: Upload article inline image ---------------------------------------
app.post('/api/my/articles/upload-image', requireAuth, upload.single('articleImage'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });
        const imageUrl = `/uploads/articles/${req.file.filename}`;
        res.json({ url: imageUrl });
    } catch (e: any) {
        logger.error('POST /api/my/articles/upload-image error', e);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// -- Writer: Upload article cover image ----------------------------------------
app.post('/api/my/articles/upload-cover', requireAuth, upload.single('articleCover'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });
        const imageUrl = `/uploads/articles/${req.file.filename}`;
        res.json({ url: imageUrl });
    } catch (e: any) {
        logger.error('POST /api/my/articles/upload-cover error', e);
        res.status(500).json({ error: 'Failed to upload cover image' });
    }
});

// -- Writer: Upload article audio (samples, loops, stems) ---------------------
app.post('/api/my/articles/upload-audio', requireAuth, upload.single('articleAudio'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
        const fileUrl = `/uploads/articles/audio/${req.file.filename}`;
        res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size });
    } catch (e: any) {
        logger.error('POST /api/my/articles/upload-audio error', e);
        res.status(500).json({ error: 'Failed to upload audio file' });
    }
});

// -- Writer: Upload article project file (.flp, .zip, .als) -------------------
app.post('/api/my/articles/upload-project', requireAuth, upload.single('articleProject'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No project file provided' });
        const fileUrl = `/uploads/articles/projects/${req.file.filename}`;
        res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size });
    } catch (e: any) {
        logger.error('POST /api/my/articles/upload-project error', e);
        res.status(500).json({ error: 'Failed to upload project file' });
    }
});

// -- Writer: Upload article preset file ----------------------------------------
app.post('/api/my/articles/upload-preset', requireAuth, upload.single('articlePreset'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No preset file provided' });
        const fileUrl = `/uploads/articles/presets/${req.file.filename}`;
        res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size });
    } catch (e: any) {
        logger.error('POST /api/my/articles/upload-preset error', e);
        res.status(500).json({ error: 'Failed to upload preset file' });
    }
});

// -------------------------------------------------------------------------------
// ��  ADMIN ARTICLE REVIEW ENDPOINTS
// -------------------------------------------------------------------------------

// -- Admin: List all articles (any status) -------------------------------------
app.get('/api/admin/articles', requireAdmin, async (req: any, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
        const status = req.query.status as string;
        const category = req.query.category as string;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (category) where.category = category;

        const [articles, total] = await Promise.all([
            db.article.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
            }),
            db.article.count({ where }),
        ]);

        res.json({ articles, total, page, totalPages: Math.ceil(total / limit) });
    } catch (e: any) {
        logger.error('GET /api/admin/articles error', e);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});

// -- Admin: Get single article by ID (for editing) ----------------------------
app.get('/api/admin/articles/:id', requireAdmin, async (req: any, res) => {
    try {
        const article = await db.article.findUnique({ where: { id: req.params.id } });
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json(article);
    } catch (e: any) {
        logger.error('GET /api/admin/articles/:id error', e);
        res.status(500).json({ error: 'Failed to fetch article' });
    }
});

// -- Admin: Create article -----------------------------------------------------
app.post('/api/admin/articles', requireAdmin, async (req: any, res) => {
    try {
        const user = req.session?.user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        const { title, subtitle, content, excerpt, coverImageUrl, category, tags, metaTitle, metaDescription, status } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

        // Generate unique slug
        let baseSlug = slugify(title);
        if (!baseSlug) baseSlug = 'article';
        let slug = baseSlug;
        let suffix = 1;
        while (await db.article.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${suffix++}`;
        }

        // Determine guild ID from session
        const guildObj = req.session?.mutualAdminGuilds?.[0] || req.session?.mutualStaffGuilds?.[0];
        const guildId = guildObj?.id;
        if (!guildId) return res.status(400).json({ error: 'No guild context found' });

        // Ensure guild exists in DB
        await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: guildObj.name || 'Unknown' } });

        const articleStatus = status === 'published' ? 'published' : (status === 'pending' ? 'pending' : 'draft');

        const article = await db.article.create({
            data: {
                guildId,
                slug,
                title: title.slice(0, 200),
                subtitle: subtitle?.slice(0, 300) || null,
                content,
                excerpt: excerpt?.slice(0, 500) || null,
                coverImageUrl: coverImageUrl || null,
                authorUserId: user.id,
                authorName: user.global_name || user.username || 'Staff',
                authorAvatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
                category: ['news', 'guide', 'announcement', 'tutorial'].includes(category) ? category : 'news',
                tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
                metaTitle: metaTitle?.slice(0, 120) || null,
                metaDescription: metaDescription?.slice(0, 300) || null,
                status: articleStatus,
                publishedAt: articleStatus === 'published' ? new Date() : null,
                reviewedByUserId: articleStatus === 'published' ? user.id : null,
                reviewedByName: articleStatus === 'published' ? (user.global_name || user.username) : null,
                reviewedAt: articleStatus === 'published' ? new Date() : null,
            },
        });

        res.status(201).json(article);
    } catch (e: any) {
        logger.error('POST /api/admin/articles error', e);
        res.status(500).json({ error: 'Failed to create article' });
    }
});

// -- Admin: Update article -----------------------------------------------------
app.patch('/api/admin/articles/:id', requireAdmin, async (req: any, res) => {
    try {
        const user = req.session?.user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        const existing = await db.article.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Article not found' });

        const { title, subtitle, content, excerpt, coverImageUrl, category, tags, metaTitle, metaDescription, status, slug: newSlug, reviewNote } = req.body;

        const data: any = { updatedAt: new Date() };
        if (title !== undefined) data.title = title.slice(0, 200);
        if (subtitle !== undefined) data.subtitle = subtitle?.slice(0, 300) || null;
        if (content !== undefined) data.content = content;
        if (excerpt !== undefined) data.excerpt = excerpt?.slice(0, 500) || null;
        if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl || null;
        if (category && ['news', 'guide', 'announcement', 'tutorial'].includes(category)) data.category = category;
        if (tags !== undefined) data.tags = Array.isArray(tags) ? tags.slice(0, 10) : existing.tags;
        if (metaTitle !== undefined) data.metaTitle = metaTitle?.slice(0, 120) || null;
        if (metaDescription !== undefined) data.metaDescription = metaDescription?.slice(0, 300) || null;

        // Review note (admin feedback on rejection / suggestions)
        if (reviewNote !== undefined) data.reviewNote = reviewNote?.slice(0, 2000) || null;

        // Slug change
        if (newSlug && newSlug !== existing.slug) {
            const slugVal = slugify(newSlug);
            const conflict = await db.article.findUnique({ where: { slug: slugVal } });
            if (conflict && conflict.id !== existing.id) {
                return res.status(409).json({ error: 'Slug already in use' });
            }
            data.slug = slugVal;
        }

        // Status transitions
        if (status && status !== existing.status) {
            data.status = status;
            if (status === 'published' && !existing.publishedAt) {
                data.publishedAt = new Date();
            }
            if (status === 'published' || status === 'rejected') {
                data.reviewedByUserId = user.id;
                data.reviewedByName = user.global_name || user.username;
                data.reviewedAt = new Date();
            }
        }

        const article = await db.article.update({ where: { id: req.params.id }, data });
        res.json(article);
    } catch (e: any) {
        logger.error('PATCH /api/admin/articles/:id error', e);
        res.status(500).json({ error: 'Failed to update article' });
    }
});

// -- Admin: Delete article -----------------------------------------------------
app.delete('/api/admin/articles/:id', requireAdmin, async (req: any, res) => {
    try {
        const existing = await db.article.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Article not found' });
        await db.article.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        logger.error('DELETE /api/admin/articles/:id error', e);
        res.status(500).json({ error: 'Failed to delete article' });
    }
});

// -- Admin: Toggle featured status ---------------------------------------------
app.patch('/api/admin/articles/:id/feature', requireAdmin, async (req: any, res) => {
    try {
        const existing = await db.article.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Article not found' });

        const isFeatured = !existing.isFeatured;

        // If featuring, un-feature any currently featured article
        if (isFeatured) {
            await db.article.updateMany({ where: { isFeatured: true }, data: { isFeatured: false, featuredAt: null } });
        }

        const article = await db.article.update({
            where: { id: req.params.id },
            data: { isFeatured, featuredAt: isFeatured ? new Date() : null },
        });
        res.json(article);
    } catch (e: any) {
        logger.error('PATCH /api/admin/articles/:id/feature error', e);
        res.status(500).json({ error: 'Failed to toggle feature status' });
    }
});

// -- Admin: Upload article image -----------------------------------------------
app.post('/api/admin/articles/upload-image', requireAdmin, upload.single('articleImage'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });
        const imageUrl = `/uploads/articles/${req.file.filename}`;
        res.json({ url: imageUrl });
    } catch (e: any) {
        logger.error('POST /api/admin/articles/upload-image error', e);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// -- Admin: Upload article cover image -----------------------------------------
app.post('/api/admin/articles/upload-cover', requireAdmin, upload.single('articleCover'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });
        const imageUrl = `/uploads/articles/${req.file.filename}`;
        res.json({ url: imageUrl });
    } catch (e: any) {
        logger.error('POST /api/admin/articles/upload-cover error', e);
        res.status(500).json({ error: 'Failed to upload cover image' });
    }
});

// -- Admin: Upload article audio -----------------------------------------------
app.post('/api/admin/articles/upload-audio', requireAdmin, upload.single('articleAudio'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
        const fileUrl = `/uploads/articles/audio/${req.file.filename}`;
        res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size });
    } catch (e: any) {
        logger.error('POST /api/admin/articles/upload-audio error', e);
        res.status(500).json({ error: 'Failed to upload audio file' });
    }
});

// -- Admin: Upload article project file ----------------------------------------
app.post('/api/admin/articles/upload-project', requireAdmin, upload.single('articleProject'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No project file provided' });
        const fileUrl = `/uploads/articles/projects/${req.file.filename}`;
        res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size });
    } catch (e: any) {
        logger.error('POST /api/admin/articles/upload-project error', e);
        res.status(500).json({ error: 'Failed to upload project file' });
    }
});

// -- Admin: Upload article preset file -----------------------------------------
app.post('/api/admin/articles/upload-preset', requireAdmin, upload.single('articlePreset'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No preset file provided' });
        const fileUrl = `/uploads/articles/presets/${req.file.filename}`;
        res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size });
    } catch (e: any) {
        logger.error('POST /api/admin/articles/upload-preset error', e);
        res.status(500).json({ error: 'Failed to upload preset file' });
    }
});

// -- Public: Get featured article for front page -------------------------------
app.get('/api/articles/featured/current', async (req: any, res) => {
    try {
        // Look up the featured article ID from discovery settings
        const settings = await db.discoverySettings.findUnique({ where: { id: 'singleton' }, select: { featuredArticleId: true } });
        if (!settings?.featuredArticleId) return res.json(null);
        const article = await db.article.findUnique({
            where: { id: settings.featuredArticleId, status: 'published' },
            select: {
                id: true, slug: true, title: true, subtitle: true, excerpt: true,
                coverImageUrl: true, authorName: true, authorAvatar: true,
                category: true, publishedAt: true, viewCount: true,
            },
        });
        res.json(article || null);
    } catch (e: any) {
        logger.error('GET /api/articles/featured/current error', e);
        res.status(500).json({ error: 'Failed to fetch featured article' });
    }
});

// --- SpamGuard Plugin Routes --------------------------------------------------

app.get('/api/spam-guard/settings/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'spam-guard')) return res.status(403).json({ error: 'Forbidden' });

        let settings = await db.spamGuardSettings.findUnique({ where: { guildId } });
        if (!settings) {
            await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
            settings = await db.spamGuardSettings.create({ data: { guildId } });
        }
        res.json(settings);
    } catch (e) {
        logger.error('Failed to get spam-guard settings', e);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

app.post('/api/spam-guard/settings/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'spam-guard')) return res.status(403).json({ error: 'Forbidden' });

        const allowed = [
            'enabled', 'attachmentLimit', 'attachmentWindowSec',
            'channelSpreadLimit', 'channelSpreadWindowSec',
            'action', 'timeoutMinutes', 'alertChannelId', 'exemptRoles',
        ];
        const data: Record<string, any> = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) data[key] = req.body[key];
        }

        if (data.action && !['timeout', 'ban', 'kick', 'delete_only'].includes(data.action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
        const settings = await db.spamGuardSettings.upsert({
            where: { guildId },
            update: data,
            create: { guildId, ...data },
        });
        res.json(settings);
    } catch (e) {
        logger.error('Failed to update spam-guard settings', e);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

app.post('/api/spam-guard/compute-hash/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'spam-guard')) return res.status(403).json({ error: 'Forbidden' });

        const { url } = req.body;
        if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });

        const parsedUrl = new URL(url); // throws if invalid
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ error: 'Only http/https URLs are allowed' });
        }

        const axios = (await import('axios')).default;
        const sharp = (await import('sharp')).default;

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 8000,
            maxContentLength: 8 * 1024 * 1024,
        });
        const buf = Buffer.from(response.data);

        // dHash: 9x8 grayscale ? compare adjacent pixels ? 64 bits ? 16 hex chars
        const raw = await sharp(buf).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer();
        let bits = '';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                bits += raw[row * 9 + col] < raw[row * 9 + col + 1] ? '1' : '0';
            }
        }
        let hex = '';
        for (let i = 0; i < 64; i += 4) {
            hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
        }

        res.json({ hash: hex });
    } catch (e: any) {
        logger.error('Failed to compute image hash', e);
        res.status(500).json({ error: 'Failed to compute hash: ' + (e.message ?? 'unknown error') });
    }
});

app.get('/api/spam-guard/hashes/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'spam-guard')) return res.status(403).json({ error: 'Forbidden' });

        const hashes = await db.spamImageHash.findMany({
            where: { guildId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(hashes);
    } catch (e) {
        logger.error('Failed to get spam hashes', e);
        res.status(500).json({ error: 'Failed to get hashes' });
    }
});

app.post('/api/spam-guard/hashes/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'spam-guard')) return res.status(403).json({ error: 'Forbidden' });

        const { hash, description } = req.body;
        if (!hash || typeof hash !== 'string' || hash.length !== 16) {
            return res.status(400).json({ error: 'Invalid hash � must be 16-char hex string' });
        }

        await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
        const entry = await db.spamImageHash.upsert({
            where: { guildId_hash: { guildId, hash } },
            update: { description: description || null, addedByMod: (req as any).session?.user?.id },
            create: {
                guildId,
                hash,
                description: description || null,
                addedByMod: (req as any).session?.user?.id,
            },
        });
        res.json(entry);
    } catch (e) {
        logger.error('Failed to add spam hash', e);
        res.status(500).json({ error: 'Failed to add hash' });
    }
});

app.delete('/api/spam-guard/hashes/:guildId/:hashId', async (req, res) => {
    try {
        const { guildId, hashId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'spam-guard')) return res.status(403).json({ error: 'Forbidden' });

        await db.spamImageHash.deleteMany({ where: { id: hashId, guildId } });
        res.json({ success: true });
    } catch (e) {
        logger.error('Failed to delete spam hash', e);
        res.status(500).json({ error: 'Failed to delete hash' });
    }
});

app.get('/api/spam-guard/incidents/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'spam-guard')) return res.status(403).json({ error: 'Forbidden' });

        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const incidents = await db.spamGuardIncident.findMany({
            where: { guildId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        res.json(incidents);
    } catch (e) {
        logger.error('Failed to get spam incidents', e);
        res.status(500).json({ error: 'Failed to get incidents' });
    }
});

// -- SpamGuard: Blocked phrases / full-message blocklist --------------------

app.get('/api/spam-guard/phrases/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'spam-guard')) return res.status(403).json({ error: 'Forbidden' });

        const phrases = await db.spamBlockedPhrase.findMany({
            where: { guildId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(phrases);
    } catch (e) {
        logger.error('Failed to get blocked phrases', e);
        res.status(500).json({ error: 'Failed to get phrases' });
    }
});

app.post('/api/spam-guard/phrases/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'spam-guard')) return res.status(403).json({ error: 'Forbidden' });

        const { phrase, description, isRegex, caseSensitive } = req.body ?? {};
        if (!phrase || typeof phrase !== 'string') {
            return res.status(400).json({ error: 'phrase is required' });
        }
        const trimmed = phrase.trim();
        if (trimmed.length < 3) {
            return res.status(400).json({ error: 'Phrase must be at least 3 characters' });
        }
        if (trimmed.length > 2000) {
            return res.status(400).json({ error: 'Phrase must be 2000 characters or fewer' });
        }
        // Validate regex if requested
        if (isRegex) {
            try { new RegExp(trimmed); } catch (err: any) {
                return res.status(400).json({ error: `Invalid regex: ${err?.message ?? 'parse error'}` });
            }
        }

        await db.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId, name: 'Unknown' } });
        // Ensure SpamGuardSettings row exists (FK target)
        await db.spamGuardSettings.upsert({
            where: { guildId },
            update: {},
            create: { guildId },
        });

        const entry = await db.spamBlockedPhrase.upsert({
            where: { guildId_phrase: { guildId, phrase: trimmed } },
            update: {
                description: description?.trim() || null,
                isRegex: !!isRegex,
                caseSensitive: !!caseSensitive,
                addedByMod: (req as any).session?.user?.id,
            },
            create: {
                guildId,
                phrase: trimmed,
                description: description?.trim() || null,
                isRegex: !!isRegex,
                caseSensitive: !!caseSensitive,
                addedByMod: (req as any).session?.user?.id,
            },
        });

        res.json(entry);
    } catch (e) {
        logger.error('Failed to add blocked phrase', e);
        res.status(500).json({ error: 'Failed to add phrase' });
    }
});

app.delete('/api/spam-guard/phrases/:guildId/:phraseId', async (req, res) => {
    try {
        const { guildId, phraseId } = req.params;
        if (!await checkPluginAccess(guildId, req, 'spam-guard')) return res.status(403).json({ error: 'Forbidden' });

        await db.spamBlockedPhrase.deleteMany({ where: { id: phraseId, guildId } });

        res.json({ success: true });
    } catch (e) {
        logger.error('Failed to delete blocked phrase', e);
        res.status(500).json({ error: 'Failed to delete phrase' });
    }
});

// -- ENHANCED PROFILE STYLES -------------------------------------------------

// Admin: search musician profiles (for targeting users without needing their Discord ID)
// Must be registered BEFORE /api/profile-styles/:userId to avoid route conflict
app.get('/api/profile-styles/users/search', async (req: any, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (q.length < 2) return res.json([]);
        const profiles = await db.musicianProfile.findMany({
            where: {
                deletedAt: null,
                status: 'active',
                OR: [
                    { username: { contains: q, mode: 'insensitive' } },
                    { displayName: { contains: q, mode: 'insensitive' } },
                ],
            },
            select: { userId: true, username: true, displayName: true, avatar: true },
            take: 10,
        });
        res.json(profiles);
    } catch (e) {
        logger.error('Failed to search profiles for style targeting', e);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Public: fetch style for a single user (no guild needed � returns first match across guilds)
app.get('/api/profile-styles/:userId', publicCache(120), async (req: any, res) => {
    try {
        const { userId } = req.params;
        const style = await (db as any).profileStyle.findFirst({ where: { userId } });
        res.json(style || null);
    } catch (e) {
        logger.error('Failed to get profile style', e);
        res.status(500).json({ error: 'Failed to get profile style' });
    }
});

// Admin: list all styled users in a guild (enriched with musician profile data)
app.get('/api/guilds/:guildId/profile-styles', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
        const styles = await (db as any).profileStyle.findMany({
            where: { guildId },
            orderBy: { grantedAt: 'desc' },
        });
        const userIds: string[] = styles.map((s: any) => s.userId);
        const profiles = userIds.length
            ? await db.musicianProfile.findMany({
                  where: { userId: { in: userIds } },
                  select: { userId: true, username: true, displayName: true, avatar: true },
              })
            : [];
        const profileMap = Object.fromEntries(profiles.map((p: any) => [p.userId, p]));
        res.json(styles.map((s: any) => ({ ...s, profile: profileMap[s.userId] || null })));
    } catch (e) {
        logger.error('Failed to list profile styles', e);
        res.status(500).json({ error: 'Failed to list profile styles' });
    }
});

// Admin: create or update style for a user
app.post('/api/guilds/:guildId/profile-styles', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
        const { userId, gradient, animation, glowColor, glowIntensity, badgeLabel, badgeColor, note } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });
        const style = await (db as any).profileStyle.upsert({
            where: { guildId_userId: { guildId, userId } },
            create: {
                guildId, userId,
                gradient: gradient || null,
                animation: animation || 'none',
                glowColor: glowColor || null,
                glowIntensity: glowIntensity ?? 6,
                badgeLabel: badgeLabel || null,
                badgeColor: badgeColor || null,
                note: note || null,
                grantedBy: req.session?.user?.id || null,
            },
            update: {
                gradient: gradient || null,
                animation: animation || 'none',
                glowColor: glowColor || null,
                glowIntensity: glowIntensity ?? 6,
                badgeLabel: badgeLabel || null,
                badgeColor: badgeColor || null,
                note: note || null,
            },
        });
        res.json(style);
    } catch (e) {
        logger.error('Failed to save profile style', e);
        res.status(500).json({ error: 'Failed to save profile style' });
    }
});

// Admin: delete style for a user
app.delete('/api/guilds/:guildId/profile-styles/:userId', async (req: any, res) => {
    try {
        const { guildId, userId } = req.params;
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
        await (db as any).profileStyle.deleteMany({ where: { guildId, userId } });
        res.json({ ok: true });
    } catch (e) {
        logger.error('Failed to delete profile style', e);
        res.status(500).json({ error: 'Failed to delete profile style' });
    }
});

// ------------------------------------------------------------------------------
// ACADEMY PLUGIN API
// ------------------------------------------------------------------------------

// --- Academy Settings (admin) ---
app.get('/api/guilds/:guildId/academy/settings', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
        let settings = await db.academySettings.findUnique({ where: { guildId } });
        if (!settings) {
            settings = await db.academySettings.create({ data: { guildId } });
        }
        res.json(settings);
    } catch (e) {
        logger.error('Failed to load academy settings', e);
        res.status(500).json({ error: 'Failed to load academy settings' });
    }
});

app.post('/api/guilds/:guildId/academy/settings', async (req: any, res) => {
    try {
        const { guildId } = req.params;
        if (!isTrueAdmin(guildId, req)) return res.status(403).json({ error: 'Forbidden' });
        const { enabled, announcementChannelId, completionRoleId, reputationReward } = req.body;
        const settings = await db.academySettings.upsert({
            where: { guildId },
            create: { guildId, enabled, announcementChannelId, completionRoleId, reputationReward },
            update: { enabled, announcementChannelId, completionRoleId, reputationReward },
        });
        res.json(settings);
    } catch (e) {
        logger.error('Failed to save academy settings', e);
        res.status(500).json({ error: 'Failed to save academy settings' });
    }
});

// --- Academy Lessons (public listing) ---
app.get('/api/academy/lessons', async (_req: any, res) => {
    try {
        const lessons = await db.academyLesson.findMany({
            where: { published: true, deletedAt: null },
            select: {
                id: true, slug: true, title: true, description: true,
                category: true, difficulty: true, order: true,
                imageUrl: true, duration: true, createdAt: true,
                _count: { select: { progress: { where: { completed: true } } } },
            },
            orderBy: [{ category: 'asc' }, { order: 'asc' }],
        });
        res.json(lessons);
    } catch (e) {
        logger.error('Failed to load academy lessons', e);
        res.status(500).json({ error: 'Failed to load lessons' });
    }
});

// --- Single Lesson (public) ---
app.get('/api/academy/lessons/:slugOrId', async (req: any, res) => {
    try {
        const { slugOrId } = req.params;
        const lesson = await db.academyLesson.findFirst({
            where: {
                deletedAt: null,
                OR: [{ id: slugOrId }, { slug: slugOrId }],
            },
        });
        if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
        if (!lesson.published) {
            // Only admins can see unpublished lessons
            const user = req.session?.user;
            if (!user || user.role !== 'admin') return res.status(404).json({ error: 'Lesson not found' });
        }
        res.json(lesson);
    } catch (e) {
        logger.error('Failed to load lesson', e);
        res.status(500).json({ error: 'Failed to load lesson' });
    }
});

// --- Admin: CRUD Lessons ---
app.post('/api/academy/admin/lessons', async (req: any, res) => {
    try {
        const user = req.session?.user;
        if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const { title, slug, description, category, difficulty, order, duration, steps, assets, published, imageUrl } = req.body;
        if (!title || !slug) return res.status(400).json({ error: 'Title and slug are required' });
        const lesson = await db.academyLesson.create({
            data: {
                title, slug, description, category, difficulty,
                order: order ?? 0, duration, steps: steps ?? [], assets: assets ?? [],
                published: published ?? false, imageUrl,
            },
        });
        res.json(lesson);
    } catch (e: any) {
        if (e.code === 'P2002') return res.status(409).json({ error: 'A lesson with this slug already exists' });
        logger.error('Failed to create lesson', e);
        res.status(500).json({ error: 'Failed to create lesson' });
    }
});

app.patch('/api/academy/admin/lessons/:id', async (req: any, res) => {
    try {
        const user = req.session?.user;
        if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const { id } = req.params;
        const { title, slug, description, category, difficulty, order, duration, steps, assets, published, imageUrl } = req.body;
        const lesson = await db.academyLesson.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(slug !== undefined && { slug }),
                ...(description !== undefined && { description }),
                ...(category !== undefined && { category }),
                ...(difficulty !== undefined && { difficulty }),
                ...(order !== undefined && { order }),
                ...(duration !== undefined && { duration }),
                ...(steps !== undefined && { steps }),
                ...(assets !== undefined && { assets }),
                ...(published !== undefined && { published }),
                ...(imageUrl !== undefined && { imageUrl }),
            },
        });
        res.json(lesson);
    } catch (e) {
        logger.error('Failed to update lesson', e);
        res.status(500).json({ error: 'Failed to update lesson' });
    }
});

app.delete('/api/academy/admin/lessons/:id', async (req: any, res) => {
    try {
        const user = req.session?.user;
        if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const { id } = req.params;
        await db.academyLesson.update({ where: { id }, data: { deletedAt: new Date() } });
        res.json({ ok: true });
    } catch (e) {
        logger.error('Failed to delete lesson', e);
        res.status(500).json({ error: 'Failed to delete lesson' });
    }
});

// --- User Progress ---
app.get('/api/academy/progress', async (req: any, res) => {
    try {
        const user = req.session?.user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const progress = await db.academyProgress.findMany({
            where: { userId: user.id },
            include: { lesson: { select: { title: true, slug: true, category: true, difficulty: true, imageUrl: true } } },
            orderBy: { updatedAt: 'desc' },
        });
        res.json(progress);
    } catch (e) {
        logger.error('Failed to load progress', e);
        res.status(500).json({ error: 'Failed to load progress' });
    }
});

app.post('/api/academy/progress/:lessonId', async (req: any, res) => {
    try {
        const user = req.session?.user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { lessonId } = req.params;
        const { currentStep, stepsCompleted } = req.body;

        // Verify lesson exists
        const lesson = await db.academyLesson.findUnique({ where: { id: lessonId } });
        if (!lesson || lesson.deletedAt) return res.status(404).json({ error: 'Lesson not found' });

        const steps = Array.isArray(lesson.steps) ? lesson.steps : [];
        const totalSteps = steps.length;
        const completedSteps: number[] = Array.isArray(stepsCompleted) ? stepsCompleted : [];
        const isCompleted = totalSteps > 0 && completedSteps.length >= totalSteps;

        const progress = await db.academyProgress.upsert({
            where: { userId_lessonId: { userId: user.id, lessonId } },
            create: {
                userId: user.id,
                lessonId,
                currentStep: currentStep ?? 0,
                stepsCompleted: completedSteps,
                completed: isCompleted,
                completedAt: isCompleted ? new Date() : null,
                score: isCompleted ? 100 : Math.round((completedSteps.length / Math.max(totalSteps, 1)) * 100),
            },
            update: {
                currentStep: currentStep ?? 0,
                stepsCompleted: completedSteps,
                completed: isCompleted,
                completedAt: isCompleted ? new Date() : undefined,
                score: isCompleted ? 100 : Math.round((completedSteps.length / Math.max(totalSteps, 1)) * 100),
            },
        });

        res.json(progress);
    } catch (e) {
        logger.error('Failed to update progress', e);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

// --- Lesson Completion Validation ---
app.post('/api/academy/complete/:lessonId', async (req: any, res) => {
    try {
        const user = req.session?.user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const { lessonId } = req.params;

        const lesson = await db.academyLesson.findUnique({ where: { id: lessonId } });
        if (!lesson || lesson.deletedAt) return res.status(404).json({ error: 'Lesson not found' });

        const steps = Array.isArray(lesson.steps) ? lesson.steps : [];
        const totalSteps = steps.length;

        // Mark fully completed
        const allSteps = Array.from({ length: totalSteps }, (_, i) => i);
        const progress = await db.academyProgress.upsert({
            where: { userId_lessonId: { userId: user.id, lessonId } },
            create: {
                userId: user.id, lessonId,
                currentStep: totalSteps, stepsCompleted: allSteps,
                completed: true, completedAt: new Date(), score: 100,
            },
            update: {
                currentStep: totalSteps, stepsCompleted: allSteps,
                completed: true, completedAt: new Date(), score: 100,
            },
        });

        res.json({ ok: true, progress });
    } catch (e) {
        logger.error('Failed to complete lesson', e);
        res.status(500).json({ error: 'Failed to complete lesson' });
    }
});

// ── Web Appeal / Support Ticket System ──────────────────────────────────────
// These routes integrate web-originated tickets with the existing Discord ticket
// system. Opening a web ticket creates a real Discord channel so mods can reply
// via Discord exactly as they do with native tickets, and the replies appear in
// the web UI (the messages endpoint already reads live from Discord for open tickets).

// POST /api/web-tickets/create — authenticated web user opens a ticket
app.post('/api/web-tickets/create', requireAuth, async (req: any, res) => {
    try {
        const userId: string = req.session.user.id;
        const displayName: string = req.session.user.global_name || req.session.user.username || userId;
        const { subject, message } = req.body;
        if (!subject?.trim() || !message?.trim()) {
            return res.status(400).json({ error: 'Subject and message are required' });
        }

        // Ticket-block check
        const dbUser = await db.user.findFirst({ where: { discordId: userId } });
        if (dbUser?.isTicketBlocked) {
            return res.status(403).json({ error: 'Your access to the support system has been revoked.' });
        }

        // Spam guard: max 1 open ticket at a time (any type)
        const existingOpenTicket = await db.ticket.findFirst({
            where: { ownerId: userId, status: 'open', deletedAt: null },
            select: { id: true },
        });
        if (existingOpenTicket) {
            return res.status(429).json({ error: 'You already have an open ticket. Please wait for it to be resolved before opening a new one.' });
        }

        const guildId = process.env.GUILD_ID;
        if (!guildId || !process.env.DISCORD_TOKEN) {
            return res.status(503).json({ error: 'Ticket system not configured on this server.' });
        }

        // Look up ticket settings for the primary guild
        const settings = await db.ticketSettings.findUnique({ where: { guildId } });

        // Channel name: appeal-username (sanitised, max 100 chars)
        const safeName = displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || userId.slice(-6);
        const channelName = `appeal-${safeName}`;

        // Permission overwrites
        const VIEW = '1024'; const SEND = '2048'; const ATTACH = '32768'; const HISTORY = '65536';
        const memberAllow = String(Number(VIEW) + Number(SEND) + Number(ATTACH) + Number(HISTORY));
        const permissionOverwrites: any[] = [
            { id: guildId, type: 0, deny: VIEW },           // @everyone: deny view
            { id: userId,  type: 1, allow: memberAllow },    // ticket owner: allow
        ];
        if (settings?.staffRoleIds?.length) {
            for (const roleId of settings.staffRoleIds) {
                permissionOverwrites.push({ id: roleId, type: 0, allow: memberAllow });
            }
        }

        // Create Discord channel
        const channelBody: any = {
            name: channelName,
            type: 0, // GUILD_TEXT
            permission_overwrites: permissionOverwrites,
        };
        if (settings?.ticketCategoryId) channelBody.parent_id = settings.ticketCategoryId;

        const channelRes = await axios.post(
            `https://discord.com/api/v10/guilds/${guildId}/channels`,
            channelBody,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
        );
        const channelId: string = channelRes.data.id;

        // Ensure the Guild record exists in DB (required for Ticket FK)
        await db.guild.upsert({
            where: { id: guildId },
            create: { id: guildId, name: channelRes.data.guild_id || 'Server' },
            update: {},
        });

        // Create Ticket record
        const ticket = await db.ticket.create({
            data: {
                channelId,
                guildId,
                ownerId: userId,
                ownerName: displayName,
                type: 'web',
                subject: subject.trim(),
                status: 'open',
            }
        });

        // Save initial message to TicketMessage
        await db.ticketMessage.create({
            data: {
                ticketId: ticket.id,
                authorId: userId,
                authorName: displayName,
                content: message.trim(),
            }
        });

        // Post embed to Discord channel
        const staffPings = settings?.staffRoleIds?.map((r: string) => `<@&${r}>`).join(' ') ?? '';
        await axios.post(
            `https://discord.com/api/v10/channels/${channelId}/messages`,
            {
                content: staffPings ? `${staffPings} — new web appeal ticket` : undefined,
                embeds: [{
                    title: `Web Appeal: ${subject.trim()}`,
                    description: `**From:** <@${userId}> (${displayName})\n\n${message.trim()}`,
                    color: 0x10B981,
                    footer: { text: `Ticket ID: ${ticket.id} • reply here or via the dashboard` },
                    timestamp: new Date().toISOString(),
                }]
            },
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
        );

        res.json(ticket);
    } catch (e: any) {
        logger.error('Failed to create web ticket', e);
        const msg = e?.response?.data?.message || 'Failed to create ticket';
        res.status(500).json({ error: msg });
    }
});

// GET /api/web-tickets/my-tickets — list the authenticated user's web tickets
app.get('/api/web-tickets/my-tickets', requireAuth, async (req: any, res) => {
    try {
        const userId: string = req.session.user.id;
        const tickets = await db.ticket.findMany({
            where: { ownerId: userId, type: 'web', deletedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        res.json(tickets);
    } catch (e) {
        logger.error('Failed to fetch web tickets', e);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

// GET /api/web-tickets/:id/messages — ticket owner views messages (live from Discord or DB)
app.get('/api/web-tickets/:id/messages', requireAuth, async (req: any, res) => {
    try {
        const userId: string = req.session.user.id;
        const ticket = await db.ticket.findUnique({ where: { id: req.params.id } });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        if (ticket.ownerId !== userId) return res.status(403).json({ error: 'Not authorized' });

        if (ticket.status === 'open') {
            // Live messages from Discord channel
            const discordRes = await axios.get(
                `https://discord.com/api/v10/channels/${ticket.channelId}/messages?limit=100`,
                { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
            );
            const msgs = (discordRes.data as any[])
                .reverse()
                .filter((m: any) => m.content?.trim())
                .map((m: any) => ({
                    id: m.id,
                    content: m.content,
                    timestamp: m.timestamp,
                    author: { id: m.author.id, username: m.author.username, avatar: m.author.avatar, bot: m.author.bot },
                }));
            return res.json(msgs);
        } else {
            // Closed: return archived TicketMessage records
            const msgs = await db.ticketMessage.findMany({
                where: { ticketId: ticket.id },
                orderBy: { createdAt: 'asc' },
            });
            return res.json(msgs.map(m => ({
                id: m.id,
                content: m.content,
                timestamp: m.createdAt,
                author: { id: m.authorId, username: m.authorName, avatar: null, bot: false },
            })));
        }
    } catch (e) {
        logger.error('Failed to fetch web ticket messages', e);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// POST /api/web-tickets/:id/reply — ticket owner posts a reply (goes to Discord)
app.post('/api/web-tickets/:id/reply', requireAuth, async (req: any, res) => {
    try {
        const userId: string = req.session.user.id;
        const displayName: string = req.session.user.global_name || req.session.user.username || userId;
        const { content } = req.body;
        if (!content?.trim()) return res.status(400).json({ error: 'Message is required' });

        const ticket = await db.ticket.findUnique({ where: { id: req.params.id } });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        if (ticket.ownerId !== userId) return res.status(403).json({ error: 'Not authorized' });
        if (ticket.status === 'closed') return res.status(400).json({ error: 'Ticket is closed' });

        // Post to Discord channel (mirrors dashboard reply format)
        await axios.post(
            `https://discord.com/api/v10/channels/${ticket.channelId}/messages`,
            { content: `**${displayName} (web):**\n${content.trim()}` },
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
        );

        // Save to DB so it survives channel deletion on close
        const saved = await db.ticketMessage.create({
            data: { ticketId: ticket.id, authorId: userId, authorName: displayName, content: content.trim() }
        });

        res.json({ id: saved.id, content: saved.content, timestamp: saved.createdAt,
            author: { id: userId, username: displayName, avatar: null, bot: false } });
    } catch (e) {
        logger.error('Failed to send web ticket reply', e);
        res.status(500).json({ error: 'Failed to send reply' });
    }
});

// Admin: toggle ticket-system block for a Discord user
app.patch('/api/web-tickets/block/:userId', requireAdmin, async (req: any, res) => {
    try {
        const { userId } = req.params;
        const user = await db.user.findFirst({ where: { discordId: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        const updated = await db.user.update({
            where: { id: user.id },
            data: { isTicketBlocked: !user.isTicketBlocked }
        });
        res.json({ isTicketBlocked: updated.isTicketBlocked });
    } catch (e) {
        logger.error('Failed to toggle ticket block', e);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

const server = app.listen(PORT, async () => {
  logger.info(`API server running on port ${PORT}`);
  // keepAliveTimeout must exceed nginx's proxy_read_timeout (default 60s).
  // Without this, Node closes the keep-alive connection before nginx expects it,
  // causing sporadic 502 Bad Gateway errors even when Node is healthy.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout   = 70_000;
  if (!R2Storage.isConfigured()) {
    logger.warn('R2 not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME missing). ZIP sample audio will be served from local storage.');
  }

  // -- Scheduled Database Backups (every 6 hours) ---------------------------
  if (R2Storage.isConfigured()) {
    const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
    const doBackup = async () => {
      try {
        const result = await runBackup();
        scheduledBackupLastAt = Date.now();
        _saveBackupStamps();
        logger.info(`[Scheduled Backup] Success: ${result.key} (${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
      } catch (e: any) {
        logger.error('[Scheduled Backup] Failed', e);
      }
    };
    // Run first backup 60s after startup (let DB connections warm up)
    setTimeout(() => {
      doBackup();
      setInterval(doBackup, BACKUP_INTERVAL_MS);
    }, 60_000);
    logger.info('[Scheduled Backup] Enabled � every 6 hours, 30-backup retention');
  } else {
    logger.warn('[Scheduled Backup] Disabled � R2 not configured');
  }

  // Backfill slugs for any battles that don't have one yet
  try {
    const unsluggedBattles = await db.beatBattle.findMany({ where: { slug: null }, select: { id: true, title: true } });
    for (const battle of unsluggedBattles) {
      const baseSlug = battle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      let slug = baseSlug;
      let suffix = 2;
      while (await db.beatBattle.findFirst({ where: { slug, NOT: { id: battle.id } } })) {
        slug = `${baseSlug}-${suffix++}`;
      }
      await db.beatBattle.update({ where: { id: battle.id }, data: { slug } });
    }
    if (unsluggedBattles.length > 0) logger.info(`Backfilled slugs for ${unsluggedBattles.length} battle(s)`);
  } catch (e) {
    logger.warn('Slug backfill skipped (migration may not have run yet)');
  }
});

// -- Graceful Shutdown ---------------------------------------------------------
// On SIGTERM/SIGINT (PM2 restart, deploy, etc.) drain the Prisma connection pool
// before the process exits so no in-flight queries are cut mid-write.
async function gracefulShutdown(signal: string) {
    logger.info(`[Shutdown] Received ${signal} � closing database connections�`);
    try {
        await db.$disconnect();
        logger.info('[Shutdown] Prisma disconnected cleanly');
    } catch (e) {
        logger.error('[Shutdown] Error disconnecting Prisma', e);
    }
    process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
