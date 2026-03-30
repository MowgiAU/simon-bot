/**
 * DatabaseBackup — Automated PostgreSQL backups to Cloudflare R2.
 *
 * - Runs pg_dump via child_process, streams the output as a gzipped buffer.
 * - Uploads to R2 under `backups/db/YYYY-MM-DD_HH-mm.sql.gz`.
 * - Retention policy: keeps last N backups, deletes older ones.
 * - Can be run standalone (`tsx src/services/DatabaseBackup.ts`) or imported
 *   and scheduled via node-cron inside the API process.
 */

import { execFile } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Logger } from '../bot/utils/logger.js';

const logger = new Logger('DatabaseBackup');

const BACKUP_PREFIX = 'backups/db/';
const DEFAULT_RETENTION_COUNT = 30; // keep last 30 backups

function getR2Client(): S3Client {
    return new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT!,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
    });
}

function isR2Configured(): boolean {
    return !!(
        process.env.R2_ENDPOINT &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME
    );
}

/**
 * Extract host, port, user, password, and database from DATABASE_URL.
 * Supports postgresql:// and postgres:// schemes.
 */
function parseDatabaseUrl(raw: string) {
    const url = new URL(raw);
    return {
        host: url.hostname,
        port: url.port || '5432',
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, '').split('?')[0],
        ssl: url.searchParams.get('sslmode') === 'require',
    };
}

/**
 * Execute `pg_dump` and collect the output as a gzipped Buffer.
 * Uses DIRECT_DATABASE_URL (bypasses pgbouncer) when available,
 * otherwise falls back to DATABASE_URL.
 */
async function pgDump(): Promise<Buffer> {
    const connUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
    if (!connUrl) throw new Error('Neither DIRECT_DATABASE_URL nor DATABASE_URL is set');

    const { host, port, user, password, database, ssl } = parseDatabaseUrl(connUrl);

    const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        PGPASSWORD: password,
    };

    const args = [
        '-h', host,
        '-p', port,
        '-U', user,
        '-d', database,
        '--no-owner',
        '--no-acl',
        '--format=plain',
        '--compress=0', // we gzip ourselves for streaming control
    ];

    if (ssl) {
        env.PGSSLMODE = 'require';
    }

    return new Promise((resolve, reject) => {
        const child = execFile('pg_dump', args, {
            env,
            maxBuffer: 512 * 1024 * 1024, // 512 MB max
            encoding: 'buffer',
        }, (error, stdout) => {
            if (error) return reject(error);
            // Gzip the raw SQL
            const chunks: Buffer[] = [];
            const gzip = createGzip({ level: 6 });
            const readable = Readable.from(stdout as Buffer);
            readable.pipe(gzip);
            gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
            gzip.on('end', () => resolve(Buffer.concat(chunks)));
            gzip.on('error', reject);
        });

        child.on('error', reject);
    });
}

/**
 * Upload a backup buffer to R2.
 */
async function uploadBackup(buffer: Buffer, key: string): Promise<void> {
    const client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;

    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/gzip',
    }));

    logger.info(`Backup uploaded to R2: ${key} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

/**
 * Enforce retention: list all objects under BACKUP_PREFIX, sort by key
 * (keys are date-stamped so lexicographic sort = chronological),
 * delete everything older than retentionCount.
 */
async function enforceRetention(retentionCount: number = DEFAULT_RETENTION_COUNT): Promise<number> {
    const client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;

    const listed = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: BACKUP_PREFIX,
    }));

    const objects = (listed.Contents || [])
        .filter(o => o.Key && o.Key.endsWith('.sql.gz'))
        .sort((a, b) => (a.Key! > b.Key! ? 1 : -1));

    if (objects.length <= retentionCount) return 0;

    const toDelete = objects.slice(0, objects.length - retentionCount);

    await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
            Objects: toDelete.map(o => ({ Key: o.Key! })),
            Quiet: true,
        },
    }));

    logger.info(`Retention: deleted ${toDelete.length} old backup(s), keeping ${retentionCount}`);
    return toDelete.length;
}

/**
 * Run a full backup cycle: dump → gzip → upload → cleanup.
 */
export async function runBackup(): Promise<{ key: string; sizeBytes: number }> {
    if (!isR2Configured()) {
        throw new Error('R2 is not configured — cannot run offsite backup');
    }

    const now = new Date();
    const stamp = now.toISOString().replace(/[T:]/g, '-').replace(/\..+$/, '');
    const key = `${BACKUP_PREFIX}${stamp}.sql.gz`;

    logger.info('Starting database backup…');
    const buffer = await pgDump();
    logger.info(`pg_dump complete — ${(buffer.length / 1024 / 1024).toFixed(2)} MB compressed`);

    await uploadBackup(buffer, key);
    await enforceRetention();

    return { key, sizeBytes: buffer.length };
}

// ── Standalone execution ────────────────────────────────────────────────────
// Run directly: `npx tsx src/services/DatabaseBackup.ts`
if (process.argv[1]?.endsWith('DatabaseBackup.ts') || process.argv[1]?.endsWith('DatabaseBackup.js')) {
    import('dotenv').then(d => d.config()).then(() => {
        runBackup()
            .then(r => { logger.info(`Backup complete: ${r.key}`); process.exit(0); })
            .catch(e => { logger.error('Backup failed', e); process.exit(1); });
    });
}
