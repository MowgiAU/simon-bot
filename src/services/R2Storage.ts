import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '../bot/utils/logger.js';

const logger = new Logger('R2Storage');

let _client: S3Client | null = null;

function getClient(): S3Client {
    if (_client) return _client;

    const accountId = process.env.R2_ACCOUNT_ID!;
    _client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
    });
    return _client;
}

export class R2Storage {
    /**
     * Returns true only when all four R2 env vars are populated.
     * When false every upload silently falls back to local storage.
     */
    static isConfigured(): boolean {
        return !!(
            process.env.R2_ACCOUNT_ID &&
            process.env.R2_ACCESS_KEY_ID &&
            process.env.R2_SECRET_ACCESS_KEY &&
            process.env.R2_BUCKET_NAME
        );
    }

    /**
     * Build a deterministic object key.
     * e.g. buildKey('samples', 'clxxx', 'kick_01.ogg') → 'samples/clxxx/kick_01.ogg'
     */
    static buildKey(category: string, trackId: string, filename: string): string {
        return `${category}/${trackId}/${filename}`;
    }

    /**
     * Upload a Buffer to R2 and return the public CDN URL.
     * Throws if R2 is not configured — callers should check isConfigured() first.
     */
    static async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
        const bucket = process.env.R2_BUCKET_NAME!;
        const cdnBase = (process.env.CDN_URL || '').replace(/\/$/, '');

        await getClient().send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            })
        );

        const url = `${cdnBase}/${key}`;
        logger.info(`Uploaded to R2: ${key}`);
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
