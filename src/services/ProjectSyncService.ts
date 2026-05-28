import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { PrismaClient } from '@prisma/client';
import { FLPParser } from '../bot/utils/FLPParser.js';
import { R2Storage } from './R2Storage.js';
import { Logger } from '../bot/utils/logger.js';

const logger = new Logger('ProjectSyncService');

const CDN_BASE = (process.env.CDN_URL || 'https://cdn.fujistud.io').replace(/\/$/, '');

function blobStorageKey(hash: string): string {
  return `project-blobs/${hash.slice(0, 2)}/${hash.slice(2)}`;
}

export interface FileCheckRequest {
  path: string;
  hash: string;
  size: number;
}

export interface CheckResult {
  missingHashes: string[];
  knownFiles: { path: string; hash: string; size: number }[];
}

export class ProjectSyncService {
  /**
   * Given a list of files (path + hash + size), return which blobs
   * already exist in storage and which need uploading.
   */
  static async checkBlobs(
    files: FileCheckRequest[],
    db: PrismaClient,
  ): Promise<CheckResult> {
    const hashes = [...new Set(files.map(f => f.hash))];
    const existing = await db.projectFileBlob.findMany({
      where: { hash: { in: hashes } },
      select: { hash: true },
    });
    const existingSet = new Set(existing.map(e => e.hash));

    const missingHashes = hashes.filter(h => !existingSet.has(h));
    return {
      missingHashes,
      knownFiles: files,
    };
  }

  /**
   * Store a file blob. Returns the storage URL.
   * Uses R2 if configured, otherwise stores locally under public/uploads/project-blobs/.
   */
  static async storeBlob(
    hash: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const key = blobStorageKey(hash);

    if (R2Storage.isConfigured()) {
      try {
        return await R2Storage.uploadBuffer(key, buffer, mimeType || 'application/octet-stream');
      } catch (err) {
        logger.warn(`R2 upload failed for blob ${hash}, falling back to local: ${err}`);
      }
    }

    const localDir = path.join(process.cwd(), 'public', 'uploads', 'project-blobs', hash.slice(0, 2));
    fs.mkdirSync(localDir, { recursive: true });
    const localPath = path.join(localDir, hash.slice(2));
    fs.writeFileSync(localPath, buffer);
    const localUrl = `/uploads/project-blobs/${hash.slice(0, 2)}/${hash.slice(2)}`;
    logger.info(`Blob saved locally: ${localUrl}`);
    return localUrl;
  }

  /**
   * Read a blob (from R2 or local) and return its buffer.
   */
  static async readBlob(
    storageKey: string,
  ): Promise<Buffer> {
    const { default: axios } = await import('axios');

    if (storageKey.startsWith('http')) {
      const resp = await axios.get(storageKey, { responseType: 'arraybuffer' });
      return Buffer.from(resp.data);
    }

    // Try local disk first
    const relativePath = storageKey.startsWith('/uploads/')
      ? storageKey.slice('/uploads/'.length)
      : storageKey;
    const localPath = path.join(process.cwd(), 'public', 'uploads', relativePath);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }

    // Not on local disk — fetch from CDN/R2
    const cdnUrl = `${CDN_BASE}/${storageKey}`;
    const resp = await axios.get(cdnUrl, { responseType: 'arraybuffer' });
    return Buffer.from(resp.data);
  }

  /**
   * Finalize a version after all files have been uploaded:
   *  - Create ProjectVersion + ProjectFileEntry records
   *  - Find and parse the .flp file in the uploaded files
   *  - Upsert ProjectFileBlob refCounts
   *  - Store arrangement on the project and version
   */
  static async finalizeVersion(
    projectId: string,
    files: FileCheckRequest[],
    db: PrismaClient,
    message?: string,
  ): Promise<any> {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, arrangement: true },
    });
    if (!project) throw new Error('Project not found');

    const lastVersion = await db.projectVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true, id: true },
    });

    // Skip creating a new version if the file set is identical to the last version
    if (lastVersion) {
      const lastEntries = await db.projectFileEntry.findMany({
        where: { versionId: lastVersion.id },
        select: { filePath: true, fileHash: true },
      });
      const incomingKey = files
        .map(f => `${f.path}:${f.hash}`)
        .sort()
        .join('|');
      const lastKey = lastEntries
        .map(e => `${e.filePath}:${e.fileHash}`)
        .sort()
        .join('|');
      if (incomingKey === lastKey) {
        logger.info(`[ProjectSync] No changes detected for project ${projectId}, skipping version creation`);
        return db.projectVersion.findUnique({
          where: { id: lastVersion.id },
          include: { fileEntries: true },
        });
      }
    }

    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    const version = await db.projectVersion.create({
      data: {
        projectId,
        versionNumber,
        message,
        totalFiles: files.length,
        totalSize,
      },
    });

    const flpEntry = files.find(f => f.path.toLowerCase().endsWith('.flp'));

    let arrangement: any = null;

    for (const file of files) {
      await db.projectFileEntry.create({
        data: {
          versionId: version.id,
          filePath: file.path,
          fileHash: file.hash,
          fileSize: file.size,
          isDirectory: false,
        },
      });

      await db.projectFileBlob.upsert({
        where: { hash: file.hash },
        update: { refCount: { increment: 1 } },
        create: {
          hash: file.hash,
          storageKey: blobStorageKey(file.hash),
          fileSize: file.size,
        },
      });
    }

    if (flpEntry) {
      try {
        const blob = await db.projectFileBlob.findUnique({
          where: { hash: flpEntry.hash },
        });
        if (blob) {
          const flpBuffer = await ProjectSyncService.readBlob(blob.storageKey);
          arrangement = FLPParser.parse(flpBuffer);
        }
      } catch (err) {
        logger.warn(`Failed to parse FLP for version ${version.id}: ${err}`);
      }
    }

    if (arrangement) {
      await db.projectVersion.update({
        where: { id: version.id },
        data: { arrangement, isParsed: true },
      });
      await db.project.update({
        where: { id: projectId },
        data: { arrangement },
      });
    }

    return db.projectVersion.findUnique({
      where: { id: version.id },
      include: { fileEntries: true },
    });
  }

  /**
   * Generate an export ZIP for a published version.
   *  - Reconstructs files from blobs
   *  - If a track is linked, includes the rendered audio and metadata.txt
   */
  static async generateExportZip(
    projectId: string,
    versionId: string,
    trackId: string | null,
    db: PrismaClient,
    tempDir: string,
  ): Promise<string> {
    const [project, version, trackLink] = await Promise.all([
      db.project.findUnique({ where: { id: projectId } }),
      db.projectVersion.findUnique({
        where: { id: versionId },
        include: { fileEntries: true },
      }),
      trackId ? db.projectTrackLink.findUnique({ where: { trackId } }) : null,
    ]);

    if (!project || !version) throw new Error('Project or version not found');

    fs.mkdirSync(tempDir, { recursive: true });
    const exportDir = path.join(tempDir, project.name);
    fs.mkdirSync(exportDir, { recursive: true });

    for (const entry of version.fileEntries) {
      if (entry.isDirectory) continue;
      const blob = await db.projectFileBlob.findUnique({ where: { hash: entry.fileHash } });
      if (!blob) {
        logger.warn(`Blob ${entry.fileHash} not found for file ${entry.filePath}`);
        continue;
      }
      const buffer = await ProjectSyncService.readBlob(blob.storageKey);
      const targetPath = path.join(exportDir, entry.filePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, buffer);
    }

    if (trackLink) {
      const track = await db.track.findUnique({ where: { id: trackId! } });
      if (track?.url) {
        let audioBuffer: Buffer;
        if (track.url.startsWith('http')) {
          const { default: axios } = await import('axios');
          const resp = await axios.get(track.url, { responseType: 'arraybuffer' });
          audioBuffer = Buffer.from(resp.data);
        } else {
          const localPath = path.join(process.cwd(), 'public', track.url);
          audioBuffer = fs.readFileSync(localPath);
        }
        const trackTitle = track.title || 'untitled';
        const audioExt = path.extname(track.url) || '.mp3';
        fs.writeFileSync(path.join(exportDir, `${trackTitle}${audioExt}`), audioBuffer);
      }

      const profile = track ? await db.musicianProfile.findUnique({
        where: { id: track.profileId },
        select: { displayName: true, username: true },
      }) : null;

      const artistName = profile?.displayName || profile?.username || 'Unknown Artist';
      const metadata = [
        `Track: ${track?.title || project.name}`,
        `Artist: ${artistName}`,
        `BPM: ${(version.arrangement as any)?.bpm ?? ''}`,
        `Key: ${track?.key ?? ''}`,
        `Description: ${track?.description || ''}`,
        ``,
        `Downloaded from Fuji Studio (https://fujistud.io)`,
        `Project: ${project.name}`,
        `Version: ${version.versionNumber}`,
        `Exported: ${new Date().toISOString()}`,
        `License: ${track?.license || 'All Rights Reserved'}`,
        ``,
        `-- Fuji Studio --`,
        `Advanced community management for FL Studio producers`,
      ].join('\n');
      fs.writeFileSync(path.join(exportDir, 'README.txt'), metadata, 'utf-8');
    }

    const zipPath = path.join(tempDir, `${project.name}_v${version.versionNumber}.zip`);
    const zip = new AdmZip();
    zip.addLocalFolder(exportDir);
    zip.writeZip(zipPath);

    return zipPath;
  }

  /**
   * Upload the export ZIP to R2 and return the URL.
   */
  static async uploadExportZip(
    projectId: string,
    versionId: string,
    zipPath: string,
  ): Promise<string> {
    const key = `projects/${projectId}/exports/${versionId}.zip`;
    const buffer = fs.readFileSync(zipPath);

    if (R2Storage.isConfigured()) {
      try {
        return await R2Storage.uploadBuffer(key, buffer, 'application/zip');
      } catch (err) {
        logger.warn(`R2 upload failed for export ZIP, serving locally: ${err}`);
      }
    }

    const localDir = path.join(process.cwd(), 'public', 'uploads', 'project-exports');
    fs.mkdirSync(localDir, { recursive: true });
    const localPath = path.join(localDir, `${projectId}_${versionId}.zip`);
    fs.writeFileSync(localPath, buffer);
    return `/uploads/project-exports/${projectId}_${versionId}.zip`;
  }

  /**
   * Clean up blobs when a version is deleted.
   * Decrements refCount and removes orphaned blobs from storage.
   */
  static async cleanupVersion(
    versionId: string,
    db: PrismaClient,
  ): Promise<void> {
    const entries = await db.projectFileEntry.findMany({
      where: { versionId },
    });

    for (const entry of entries) {
      const blob = await db.projectFileBlob.findUnique({
        where: { hash: entry.fileHash },
      });
      if (!blob) continue;

      if (blob.refCount <= 1) {
        try {
          await R2Storage.deleteObject(blob.storageKey);
        } catch (err) {
          logger.warn(`R2 delete failed for blob ${blob.storageKey}: ${err}`);
        }
        await db.projectFileBlob.delete({ where: { hash: entry.fileHash } });
      } else {
        await db.projectFileBlob.update({
          where: { hash: entry.fileHash },
          data: { refCount: { decrement: 1 } },
        });
      }
    }

    await db.projectFileEntry.deleteMany({ where: { versionId } });
  }
}
