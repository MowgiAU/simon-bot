/**
 * Uploads a file straight to storage, for any feature that takes one.
 *
 * The API signs a URL, the browser PUTs the file to it, and the feature's own endpoint is then
 * given the key. Nothing large travels through the API, so uploads aren't capped at the 100 MB a
 * proxied request body allows, and progress is the real upload rather than a buffered copy.
 *
 *   const { key } = await uploadFile(file, 'convert', setPct);
 *   await axios.post('/api/convert/from-upload', { key, name: file.name });
 *
 * When direct upload isn't available (storage not configured), presign answers 501 and this throws
 * DirectUploadUnavailable — callers that still have a POST-the-file path can fall back to it.
 */
import axios from 'axios';

export type UploadPurpose = 'convert' | 'track-audio' | 'track-project' | 'track-stems' | 'image';

export class DirectUploadUnavailable extends Error {}

export interface UploadedFile { key: string; name: string; size: number }

/** Uploads `file` and returns the key to hand to the feature's endpoint. */
export async function uploadFile(
    file: File,
    purpose: UploadPurpose,
    onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
    const contentType = file.type || 'application/octet-stream';
    let signed: { key: string; url: string };
    try {
        const { data } = await axios.post<{ key: string; url: string }>(
            '/api/uploads/presign',
            { purpose, name: file.name, size: file.size, contentType },
            { withCredentials: true },
        );
        signed = data;
    } catch (e: any) {
        if (e?.response?.status === 501) throw new DirectUploadUnavailable('Direct uploads are not available right now.');
        throw new Error(e?.response?.data?.error || 'That upload could not be started.');
    }

    // Storage is a different origin, so no cookies here — the signature is the whole authorisation
    await axios.put(signed.url, file, {
        headers: { 'Content-Type': contentType },
        withCredentials: false,
        onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    });

    return { key: signed.key, name: file.name, size: file.size };
}
