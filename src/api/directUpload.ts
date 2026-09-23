/**
 * Direct-to-R2 uploads.
 *
 * Cloudflare caps a proxied request body at 100 MB, and every byte that goes through the API costs
 * the droplet's memory and bandwidth. So the browser asks for a signed URL, PUTs the file straight
 * to R2, and then tells the feature's own endpoint which key to use.
 *
 * The signature covers the key and content type, so the holder of a URL can't write anywhere else
 * or claim a different type. Keys always land under `incoming/<purpose>/<userId>/`, which is what
 * claimUploadKey() checks before a feature touches the object — one user can't hand another user's
 * upload to their own endpoint.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { R2Storage } from '../services/R2Storage.js';

export interface UploadPurpose {
    /** File extensions allowed, lower case with the dot. */
    extensions: string[];
    /** Largest file this purpose accepts, in bytes. */
    maxBytes: number;
    /** Content types allowed, as prefixes ('audio/' matches audio/wav). Empty = any. */
    contentTypes?: string[];
}

const MB = 1024 * 1024;

/** What the browser is allowed to upload, per feature. */
export const UPLOAD_PURPOSES: Record<string, UploadPurpose> = {
    // Ableton projects for the converter. The zip is read in memory to convert, so this is held
    // to what the server can actually chew through, not to what R2 would accept.
    convert: { extensions: ['.zip', '.als'], maxBytes: 600 * MB },
    // Audio for a track, before the API transcodes it
    'track-audio': { extensions: ['.wav', '.mp3', '.flac', '.aiff', '.aif', '.ogg', '.m4a'], maxBytes: 600 * MB, contentTypes: ['audio/', 'application/octet-stream'] },
    // A track's FL/Ableton project file or zip
    'track-project': { extensions: ['.flp', '.als', '.zip'], maxBytes: 1024 * MB },
    // Stems, artwork and the project-sync bundles
    'track-stems': { extensions: ['.zip'], maxBytes: 1024 * MB },
    image: { extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif'], maxBytes: 25 * MB, contentTypes: ['image/'] },
};

export interface PresignedUpload { key: string; url: string; expiresIn: number }

/**
 * Signs one upload for this user. Throws with a message meant for the user when the file doesn't
 * fit the purpose; the caller turns that into a 400.
 */
export async function presignUpload(
    purposeName: string,
    userId: string,
    fileName: string,
    size: number,
    contentType: string,
): Promise<PresignedUpload> {
    const purpose = UPLOAD_PURPOSES[purposeName];
    if (!purpose) throw new Error('Unknown upload type.');
    if (!R2Storage.isConfigured()) throw new Error('Direct uploads are not available right now.');

    const ext = path.extname(fileName).toLowerCase();
    if (!purpose.extensions.includes(ext)) {
        throw new Error(`That file type isn’t accepted here — use ${purpose.extensions.join(', ')}.`);
    }
    if (!Number.isFinite(size) || size <= 0 || size > purpose.maxBytes) {
        throw new Error(`That file is over the ${Math.round(purpose.maxBytes / MB)} MB limit.`);
    }
    const type = (contentType || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    if (purpose.contentTypes && !purpose.contentTypes.some((c) => type.startsWith(c))) {
        throw new Error('That file type isn’t accepted here.');
    }

    const key = `incoming/${purposeName}/${userId}/${crypto.randomUUID()}${ext}`;
    const expiresIn = 3600;   // big uploads take a while, and the URL is single-purpose
    return { key, url: await R2Storage.presignPut(key, type, expiresIn), expiresIn };
}

/**
 * Checks that a key the browser handed back really is this user's upload for this purpose, and
 * that the object arrived. Returns its size. Anything else throws.
 */
export async function claimUploadKey(key: string, purposeName: string, userId: string): Promise<number> {
    const prefix = `incoming/${purposeName}/${userId}/`;
    if (!key.startsWith(prefix) || key.includes('..') || key.length > 300) {
        throw new Error('That upload wasn’t found — please upload it again.');
    }
    const size = await R2Storage.getObjectSize(key);
    if (size === null) throw new Error('That upload wasn’t found — please upload it again.');
    const purpose = UPLOAD_PURPOSES[purposeName];
    if (purpose && size > purpose.maxBytes) throw new Error('That upload is too big.');
    return size;
}
