import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '../bot/utils/logger.js';

const logger = new Logger('R2Storage');

let _client: S3Client | null = null;

function getClient(): S3Client {
    if (_client) return _client;

    _client = new S3Client({
        region: 'auto',
        // Use R2_ENDPOINT directly: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
        endpoint: process.env.R2_ENDPOINT!,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
    });
    return _client;
}

export class R2Storage {
    /**
     * Returns true only when all required R2 env vars are populated.
     * When false every upload silently falls back to local storage.
     */
    static isConfigured(): boolean {
        return !!(
            process.env.R2_ENDPOINT &&
            process.env.R2_ACCESS_KEY_ID &&
            process.env.R2_SECRET_ACCESS_KEY &&
            process.env.R2_BUCKET_NAME
        );
    }

    /**
     * Build a deterministic object key.
     * e.g. buildKey('projects', 'clxxx', 'kick_01.ogg') → 'projects/clxxx/kick_01.ogg'
     */
    static buildKey(category: string, trackId: string, filename: string): string {
        return `${category}/${trackId}/${filename}`;
    }

    /**
     * Upload a Buffer to R2 and return the public CDN URL.
     * Also logs the ETag returned by R2 — callers can use it for conditional requests.
     * Throws if R2 is not configured — callers should check isConfigured() first.
     */
    static async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
        const bucket = process.env.R2_BUCKET_NAME!;
        const cdnBase = (process.env.CDN_URL || '').replace(/\/$/, '');

        const result = await getClient().send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: buffer,
                ContentType: contentType,
                // 7-day edge cache — Cloudflare will serve from CDN without hitting R2
                CacheControl: 'public, max-age=604800',
            })
        );

        // ETag enables conditional requests (If-None-Match) from the FLP parser,
        // saving R2 Class B read operations on unchanged samples.
        const etag = result.ETag ?? 'unknown';
        const url = `${cdnBase}/${key}`;
        logger.info(`Uploaded to R2: ${key} (ETag: ${etag})`);
        return url;
    }

    /**
     * Delete an object from R2 by key. No-op if R2 is not configured.
     */
    static async deleteObject(key: string): Promise<void> {
        if (!R2Storage.isConfigured()) return;
        const bucket = process.env.R2_BUCKET_NAME!;
        try {
            await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
            logger.info(`Deleted from R2: ${key}`);
        } catch (err: any) {
            logger.warn(`Failed to delete R2 object ${key}: ${err.message}`);
        }
    }
}
