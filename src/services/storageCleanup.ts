/**
 * Shared file-deletion helper.
 *
 * Uploads land in one of two places depending on whether R2 is configured: the CDN, or
 * public/uploads on local disk. Deleting one has to handle both, and must no-op safely on
 * null/Discord/external URLs. Lives here rather than in the API entrypoint so services
 * (notably AccountDeletionService) can reuse the exact same logic.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { R2Storage } from './R2Storage.js';

const CDN_BASE = (process.env.CDN_URL || 'https://cdn.fujistud.io').replace(/\/$/, '');
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Deletes a file from R2 (when URL is a CDN URL) or from local disk (when URL is a /uploads/
 * path). Safe to call with null/undefined or Discord/external URLs — no-ops in those cases.
 */
export async function deleteStoredFile(url: string | null | undefined): Promise<void> {
    if (!url) return;
    if (url.startsWith(CDN_BASE + '/')) {
        const key = url.slice(CDN_BASE.length + 1);
        await R2Storage.deleteObject(key);
    } else if (url.startsWith('/uploads/')) {
        const filePath = path.resolve(PROJECT_ROOT, 'public', url.slice(1));
        const publicDir = path.resolve(PROJECT_ROOT, 'public');
        if (!filePath.startsWith(publicDir + path.sep)) return; // Block path traversal
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* already gone */ }
    }
}

/** Best-effort bulk delete — one bad URL never blocks the rest of a purge. */
export async function deleteStoredFiles(urls: (string | null | undefined)[]): Promise<void> {
    await Promise.all(urls.map(u => deleteStoredFile(u).catch(() => {})));
}
