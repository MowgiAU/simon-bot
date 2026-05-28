import type { RequestHandler, Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { ProjectSyncService } from '../../services/ProjectSyncService.js';
import { Logger } from '../../bot/utils/logger.js';

const logger = new Logger('ProjectRoutes');

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');

function safeSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return base || `project-${Date.now()}`;
}

function generateDeviceCode(): string {
  return crypto.randomBytes(20).toString('hex');
}

function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
    if (i === 3) code += '-';
  }
  return code;
}

interface PendingDeviceAuth {
  deviceCode: string;
  userCode: string;
  clientId: string;
  scopes: string[];
  expiresAt: Date;
  interval: number;
  verified: boolean;
  userId: string | null;
}

const pendingDeviceAuths = new Map<string, PendingDeviceAuth>();

function cleanupExpiredAuths(): void {
  const now = new Date();
  for (const [code, auth] of pendingDeviceAuths) {
    if (auth.expiresAt <= now) {
      pendingDeviceAuths.delete(code);
    }
  }
}

setInterval(cleanupExpiredAuths, 60_000);

/**
 * Express middleware that accepts either a session cookie (browser users)
 * or an `Authorization: Bearer <token>` header (desktop app OAuth).
 * Tokens are persisted in the `desktop_tokens` DB table so they survive restarts.
 */
function makeRequireProjectAuth(requireAuth: RequestHandler, db: PrismaClient): RequestHandler {
  return async (req: any, res: any, next: any) => {
    const authHeader = req.headers?.authorization as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const row = await db.desktopToken.findUnique({ where: { token } });
        if (!row || row.expiresAt <= new Date()) {
          return res.status(401).json({ error: 'Token invalid or expired. Please sign in again via the desktop app.' });
        }
        if (!req.session) req.session = {} as any;
        req.session.user = { id: row.userId };
        return next();
      } catch (e) {
        logger.error('Failed to validate desktop token', e);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
    return requireAuth(req, res, next);
  };
}

const TEMP_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'project-tmp');

export function registerProjectRoutes(
  app: Express,
  db: PrismaClient,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
): void {

  const requireProjectAuth = makeRequireProjectAuth(requireAuth, db);

  // Periodically prune expired desktop tokens from the DB
  setInterval(async () => {
    await db.desktopToken.deleteMany({ where: { expiresAt: { lte: new Date() } } }).catch(() => {});
  }, 60 * 60 * 1000);

  const syncLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    keyGenerator: (req: any) => req.session?.user?.id ?? 'unknown',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: 'Too many sync requests. Please slow down.' },
  });

  const uploadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 500,
    keyGenerator: (req: any) => req.session?.user?.id ?? 'unknown',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: 'Too many file uploads. Please wait before continuing.' },
  });

  // ─── OAuth Device Flow ──────────────────────────────────────────────────

  app.post('/api/oauth/device/start', (req: any, res) => {
    const { client_id, scope } = req.body;
    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    const expiresIn = 600; // 10 minutes

    pendingDeviceAuths.set(deviceCode, {
      deviceCode,
      userCode,
      clientId: client_id,
      scopes: (scope || '').split(' ').filter(Boolean),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      interval: 5,
      verified: false,
      userId: null,
    });

    res.json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: 'https://fujistud.io/oauth/device',
      verification_uri_complete: `https://fujistud.io/oauth/device?code=${userCode}`,
      expires_in: expiresIn,
      interval: 5,
    });
  });

  app.post('/api/oauth/device/poll', async (req: any, res) => {
    const { device_code } = req.body;
    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    const auth = pendingDeviceAuths.get(device_code);
    if (!auth) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Device code not found or expired' });
    }

    if (new Date() > auth.expiresAt) {
      pendingDeviceAuths.delete(device_code);
      return res.status(400).json({ error: 'expired_token', error_description: 'Device code expired' });
    }

    if (!auth.verified || !auth.userId) {
      return res.status(400).json({ error: 'authorization_pending', error_description: 'User has not yet authorized' });
    }

    pendingDeviceAuths.delete(device_code);

    const token = crypto.randomBytes(32).toString('hex');
    const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await db.desktopToken.create({ data: { token, userId: auth.userId!, expiresAt } });

    res.json({
      access_token: token,
      token_type: 'Bearer',
      scope: auth.scopes.join(' '),
      expires_in: TOKEN_TTL_MS / 1000,
    });
  });

  app.post('/api/oauth/device/revoke', async (req: any, res) => {
    const authHeader = req.headers?.authorization as string | undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.body?.token;
    if (token) {
      await db.desktopToken.deleteMany({ where: { token } }).catch(() => {});
    }
    res.json({ success: true });
  });

  app.get('/api/oauth/device/verify', (req: any, res) => {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).json({ error: 'Missing verification code' });
    }

    const normalized = code.replace(/[\s-]/g, '').toUpperCase();
    for (const [, auth] of pendingDeviceAuths) {
      if (auth.userCode.replace(/[\s-]/g, '').toUpperCase() === normalized && !auth.verified) {
        // Use _localId (DB UUID) — session.user.id is the Discord snowflake for Discord-linked accounts
        const userId = req.session?.user?._localId || req.session?.user?.id || null;
        if (!userId) {
          return res.status(401).json({ error: 'You must be logged in to authorize this device' });
        }
        auth.verified = true;
        auth.userId = userId;
        return res.json({ success: true, message: 'Device authorized' });
      }
    }

    res.status(404).json({ error: 'Invalid or already used verification code' });
  });

  // ─── Desktop track picker ──────────────────────────────────────────────

  app.get('/api/projects/my-tracks', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const profile = await db.musicianProfile.findFirst({
        where: { userId },
        orderBy: { totalPlays: 'desc' },
      });
      if (!profile) return res.json([]);
      const tracks = await db.track.findMany({
        where: { profileId: profile.id, status: 'active' },
        select: { id: true, title: true, coverUrl: true, duration: true, isPublic: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(tracks);
    } catch (e: any) {
      logger.error('Failed to fetch my tracks', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Project CRUD ──────────────────────────────────────────────────────

  app.get('/api/projects', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const projects = await db.project.findMany({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { versionNumber: true, totalFiles: true, totalSize: true, createdAt: true, isParsed: true },
          },
          trackLinks: {
            select: { trackId: true, track: { select: { title: true, slug: true } } },
          },
        },
      });
      res.json(projects);
    } catch (e: any) {
      logger.error('Failed to fetch projects', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/projects', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Project name is required' });
      }

      let slug = safeSlug(name);
      let suffix = 2;
      while (await db.project.findFirst({ where: { userId, slug, deletedAt: null } })) {
        slug = `${safeSlug(name)}-${suffix++}`;
      }

      const project = await db.project.create({
        data: {
          userId,
          name: name.trim(),
          slug,
          description: description || null,
        },
      });

      res.status(201).json(project);
    } catch (e: any) {
      logger.error('Failed to create project', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/projects/:projectId', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      logger.info(`[ProjectDetail] Fetching ${req.params.projectId} for userId=${userId} (_localId=${req.session.user._localId} id=${req.session.user.id})`);
      const project = await db.project.findFirst({
        where: { id: req.params.projectId, userId, deletedAt: null },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            include: {
              fileEntries: {
                select: { filePath: true, fileHash: true, fileSize: true },
              },
              trackLinks: {
                select: { trackId: true, track: { select: { title: true, slug: true } } },
              },
            },
          },
          trackLinks: {
            select: { trackId: true, versionId: true, track: { select: { title: true, slug: true } } },
          },
        },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project);
    } catch (e: any) {
      logger.error('Failed to fetch project', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/projects/:projectId', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const { name, description } = req.body;

      const existing = await db.project.findFirst({
        where: { id: req.params.projectId, userId, deletedAt: null },
      });
      if (!existing) return res.status(404).json({ error: 'Project not found' });

      const updateData: any = {};
      if (name !== undefined) {
        updateData.name = name.trim();
        updateData.slug = safeSlug(name);
      }
      if (description !== undefined) {
        updateData.description = description;
      }

      const project = await db.project.update({
        where: { id: req.params.projectId },
        data: updateData,
      });

      res.json(project);
    } catch (e: any) {
      logger.error('Failed to update project', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const existing = await db.project.findFirst({
        where: { id: req.params.projectId, userId, deletedAt: null },
      });
      if (!existing) return res.status(404).json({ error: 'Project not found' });

      await db.project.update({
        where: { id: req.params.projectId },
        data: { deletedAt: new Date() },
      });

      res.json({ success: true });
    } catch (e: any) {
      logger.error('Failed to delete project', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Sync Protocol ─────────────────────────────────────────────────────

  app.post('/api/projects/:projectId/versions/check', requireProjectAuth, syncLimiter, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const project = await db.project.findFirst({
        where: { id: req.params.projectId, userId, deletedAt: null },
      });
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { files } = req.body;
      if (!Array.isArray(files)) {
        return res.status(400).json({ error: 'files array is required' });
      }

      const result = await ProjectSyncService.checkBlobs(files, db);
      res.json(result);
    } catch (e: any) {
      logger.error('Failed to check blobs', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const blobUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
        cb(null, TEMP_UPLOAD_DIR);
      },
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
      },
    }),
    limits: { fileSize: 500 * 1024 * 1024 },
  });

  app.post(
    '/api/projects/:projectId/versions/upload-file',
    requireProjectAuth,
    uploadLimiter,
    blobUpload.single('file'),
    async (req: any, res) => {
      try {
        const userId = req.session.user._localId || req.session.user.id;
        const project = await db.project.findFirst({
          where: { id: req.params.projectId, userId, deletedAt: null },
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const file = req.file as Express.Multer.File | undefined;
        if (!file) return res.status(400).json({ error: 'File is required' });

        const expectedHash = req.body.hash as string;
        if (!expectedHash) {
          fs.unlinkSync(file.path);
          return res.status(400).json({ error: 'hash is required' });
        }

        const buffer = fs.readFileSync(file.path);
        const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');

        if (actualHash !== expectedHash) {
          fs.unlinkSync(file.path);
          return res.status(400).json({ error: 'Hash mismatch: file content does not match provided hash' });
        }

        const mimeType = file.mimetype || 'application/octet-stream';
        const url = await ProjectSyncService.storeBlob(actualHash, buffer, mimeType);

        await db.projectFileBlob.upsert({
          where: { hash: actualHash },
          update: { mimeType },
          create: {
            hash: actualHash,
            storageKey: `project-blobs/${actualHash.slice(0, 2)}/${actualHash.slice(2)}`,
            fileSize: buffer.length,
            mimeType,
          },
        });

        fs.unlinkSync(file.path);

        res.json({ hash: actualHash, storageUrl: url });
      } catch (e: any) {
        logger.error('Failed to upload file blob', e);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.post('/api/projects/:projectId/versions/complete', requireProjectAuth, syncLimiter, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const project = await db.project.findFirst({
        where: { id: req.params.projectId, userId, deletedAt: null },
      });
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { files, message } = req.body;
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'files array is required and must not be empty' });
      }

      const version = await ProjectSyncService.finalizeVersion(
        req.params.projectId,
        files,
        db,
        message,
      );

      res.status(201).json(version);
    } catch (e: any) {
      logger.error('Failed to finalize version', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Version History ───────────────────────────────────────────────────

  app.get('/api/projects/:projectId/versions', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const project = await db.project.findFirst({
        where: { id: req.params.projectId, userId, deletedAt: null },
      });
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const versions = await db.projectVersion.findMany({
        where: { projectId: req.params.projectId },
        orderBy: { versionNumber: 'desc' },
        include: {
          fileEntries: {
            select: { filePath: true, fileHash: true, fileSize: true },
          },
        },
      });

      res.json(versions);
    } catch (e: any) {
      logger.error('Failed to fetch versions', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/projects/:projectId/versions/:versionId/diff', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const project = await db.project.findFirst({
        where: { id: req.params.projectId, userId, deletedAt: null },
      });
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const version = await db.projectVersion.findUnique({
        where: { id: req.params.versionId },
        include: { fileEntries: true },
      });
      if (!version || version.projectId !== req.params.projectId) {
        return res.status(404).json({ error: 'Version not found' });
      }

      const previousVersion = await db.projectVersion.findFirst({
        where: {
          projectId: req.params.projectId,
          versionNumber: { lt: version.versionNumber },
        },
        orderBy: { versionNumber: 'desc' },
        include: { fileEntries: true },
      });

      const currentFiles = new Map(version.fileEntries.map(f => [f.filePath, f]));
      const previousFiles = previousVersion
        ? new Map(previousVersion.fileEntries.map(f => [f.filePath, f]))
        : new Map();

      const added: string[] = [];
      const changed: string[] = [];
      const removed: string[] = [];

      for (const [filePath, entry] of currentFiles) {
        const prev = previousFiles.get(filePath);
        if (!prev) {
          added.push(filePath);
        } else if (prev.fileHash !== entry.fileHash) {
          changed.push(filePath);
        }
      }

      if (previousFiles.size > 0) {
        for (const [filePath] of previousFiles) {
          if (!currentFiles.has(filePath)) {
            removed.push(filePath);
          }
        }
      }

      res.json({
        versionNumber: version.versionNumber,
        previousVersionNumber: previousVersion?.versionNumber ?? null,
        totalFiles: version.totalFiles,
        totalSize: version.totalSize,
        added,
        changed,
        removed,
        createdAt: version.createdAt,
      });
    } catch (e: any) {
      logger.error('Failed to compute version diff', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Publishing ────────────────────────────────────────────────────────

  app.post('/api/projects/:projectId/publish', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const project = await db.project.findFirst({
        where: { id: req.params.projectId, userId, deletedAt: null },
      });
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { versionId, trackId } = req.body;
      if (!versionId) {
        return res.status(400).json({ error: 'versionId is required' });
      }
      if (!trackId || typeof trackId !== 'string') {
        return res.status(400).json({
          error: 'trackId is required. Upload a track first, then attach a project version to it.',
        });
      }

      const version = await db.projectVersion.findUnique({
        where: { id: versionId },
        include: { fileEntries: true },
      });
      if (!version || version.projectId !== req.params.projectId) {
        return res.status(404).json({ error: 'Version not found' });
      }

      const track = await db.track.findUnique({ where: { id: trackId } });
      if (!track) return res.status(404).json({ error: 'Track not found' });

      const profile = await db.musicianProfile.findUnique({ where: { id: track.profileId } });
      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ error: 'Track does not belong to you' });
      }

      const existingLink = await db.projectTrackLink.findUnique({ where: { trackId } });
      if (existingLink) {
        return res.status(400).json({
          error: 'Track already has a linked project version. Unpublish first.',
        });
      }

      const link = await db.projectTrackLink.create({
        data: {
          projectId: req.params.projectId,
          versionId,
          trackId,
        },
      });

      const tempDir = path.join(process.cwd(), 'uploads', 'tmp', `export_${project.id}_${version.id}`);
      const zipPath = await ProjectSyncService.generateExportZip(
        req.params.projectId,
        versionId,
        trackId,
        db,
        tempDir,
      );

      const zipUrl = await ProjectSyncService.uploadExportZip(
        req.params.projectId,
        versionId,
        zipPath,
      );

      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

      await db.track.update({
        where: { id: trackId },
        data: {
          projectZipUrl: zipUrl,
          arrangement: version.arrangement || undefined,
        },
      });

      res.status(201).json({
        link,
        exportZipUrl: zipUrl,
      });
    } catch (e: any) {
      logger.error('Failed to publish project version', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/unpublish', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const project = await db.project.findFirst({
        where: { id: req.params.projectId, userId, deletedAt: null },
      });
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { trackId } = req.body;
      if (!trackId) return res.status(400).json({ error: 'trackId is required' });

      const link = await db.projectTrackLink.findUnique({ where: { trackId } });
      if (!link || link.projectId !== req.params.projectId) {
        return res.status(404).json({ error: 'No link found for this track' });
      }

      const track = await db.track.findUnique({ where: { id: trackId } });
      if (track) {
        await db.track.update({
          where: { id: trackId },
          data: {
            projectZipUrl: null,
          },
        });
      }

      await db.projectTrackLink.delete({ where: { trackId } });

      res.json({ success: true });
    } catch (e: any) {
      logger.error('Failed to unpublish project version', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Downloads ─────────────────────────────────────────────────────────

  app.get('/api/projects/:projectId/download/:versionId', requireProjectAuth, async (req: any, res) => {
    try {
      const userId = req.session.user._localId || req.session.user.id;
      const project = await db.project.findFirst({
        where: { id: req.params.projectId, userId, deletedAt: null },
      });
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const version = await db.projectVersion.findUnique({
        where: { id: req.params.versionId },
        include: { fileEntries: true },
      });
      if (!version || version.projectId !== req.params.projectId) {
        return res.status(404).json({ error: 'Version not found' });
      }

      const tempDir = path.join(process.cwd(), 'uploads', 'tmp', `dl_${version.id}`);
      const zipPath = await ProjectSyncService.generateExportZip(
        req.params.projectId,
        req.params.versionId,
        null,
        db,
        tempDir,
      );

      const filename = `${project.name}_v${version.versionNumber}.zip`;

      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader('Content-Type', 'application/zip');

      const stream = fs.createReadStream(zipPath);
      stream.on('close', () => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      });
      stream.pipe(res);
    } catch (e: any) {
      logger.error('Failed to download project version', e);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // ─── Desktop app update manifest ──────────────────────────────────────

  const DESKTOP_MANIFEST_PATH = path.join(PROJECT_ROOT, 'data', 'desktop-latest.json');

  // Public endpoint — Tauri updater polls this on startup
  app.get('/api/desktop/update', (req: any, res) => {
    try {
      if (!fs.existsSync(DESKTOP_MANIFEST_PATH)) {
        return res.status(204).end(); // no release yet
      }
      const manifest = JSON.parse(fs.readFileSync(DESKTOP_MANIFEST_PATH, 'utf-8'));
      res.json(manifest);
    } catch {
      res.status(204).end();
    }
  });

  // Admin endpoint — called by the release script to publish a new version
  const releaseUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

  app.post(
    '/api/desktop/publish-release',
    requireAdmin,
    releaseUpload.fields([
      { name: 'installer', maxCount: 1 },
      { name: 'signature', maxCount: 1 },
    ]),
    async (req: any, res) => {
      try {
        const { version, notes } = req.body;
        if (!version) return res.status(400).json({ error: 'version is required' });

        const files = req.files as Record<string, Express.Multer.File[]>;
        const installer = files?.installer?.[0];
        const sigFile = files?.signature?.[0];
        if (!installer || !sigFile) {
          return res.status(400).json({ error: 'installer and signature files are required' });
        }

        const { R2Storage } = await import('../../services/R2Storage.js');
        const r2Key = `desktop-releases/${version}/Fuji-Studio_${version}_x64-setup.exe`;
        const installerUrl = await R2Storage.uploadBuffer(r2Key, installer.buffer, 'application/octet-stream');
        const sig = sigFile.buffer.toString('utf-8').trim();

        const manifest = {
          version,
          notes: notes || '',
          pub_date: new Date().toISOString(),
          platforms: {
            'windows-x86_64': {
              signature: sig,
              url: installerUrl,
            },
          },
        };

        fs.mkdirSync(path.join(PROJECT_ROOT, 'data'), { recursive: true });
        fs.writeFileSync(DESKTOP_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

        logger.info(`Desktop release v${version} published`);
        res.json({ success: true, manifest });
      } catch (e: any) {
        logger.error('Failed to publish desktop release', e);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );
}
