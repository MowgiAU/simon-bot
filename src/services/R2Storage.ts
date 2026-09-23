import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
     * Get the content length of an R2 object by key. Returns null if not found or R2 not configured.
     */
    static async getObjectSize(key: string): Promise<number | null> {
        if (!R2Storage.isConfigured()) return null;
        const bucket = process.env.R2_BUCKET_NAME!;
        try {
            const result = await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
            return result.ContentLength ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Extract the R2 object key from a CDN URL. Returns null if the URL is not a CDN URL.
     */
    static keyFromCdnUrl(url: string): string | null {
        const cdnBase = (process.env.CDN_URL || '').replace(/\/$/, '');
        if (!cdnBase || !url.startsWith(cdnBase + '/')) return null;
        return url.slice(cdnBase.length + 1);
    }

    /**
     * A URL the browser can PUT this object to directly, without the file passing through the API
     * (and so without Cloudflare's 100 MB limit on a proxied request body). The signature covers
     * the key and content type, so neither can be changed by whoever holds the URL.
     */
    static async presignPut(key: string, contentType: string, expiresInSeconds = 900): Promise<string> {
        const command = new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key, ContentType: contentType });
        return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
    }

    /** Streams an object down to a local file, for work that needs it on disk. */
    static async downloadToFile(key: string, destPath: string): Promise<void> {
        const result = await getClient().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
        if (!result.Body) throw new Error(`R2 object ${key} is empty`);
        await pipeline(result.Body as Readable, fs.createWriteStream(destPath));
    }

    /** Allows browsers on these origins to PUT straight to the bucket (run once per bucket). */
    static async setCorsOrigins(origins: string[]): Promise<void> {
        await getClient().send(new PutBucketCorsCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            CORSConfiguration: {
                CORSRules: [{
                    AllowedOrigins: origins,
                    AllowedMethods: ['PUT', 'GET', 'HEAD'],
                    AllowedHeaders: ['content-type'],
                    ExposeHeaders: ['etag'],
                    MaxAgeSeconds: 3600,
                }],
            },
        }));
        logger.info(`R2 CORS set for: ${origins.join(', ')}`);
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
