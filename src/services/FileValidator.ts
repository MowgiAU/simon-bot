/**
 * FileValidator — OWASP-aligned file upload security.
 *
 * Validates file content by magic bytes (not just extension) to prevent
 * MIME-type confusion attacks and path traversal. Throws on invalid input.
 */

// Max sizes
const MAX_AUDIO_BYTES   = 50 * 1024 * 1024;  // 50 MB
const MAX_IMAGE_BYTES   = 10 * 1024 * 1024;  // 10 MB
const MAX_PROJECT_BYTES = 100 * 1024 * 1024; // 100 MB

type MagicEntry = { bytes: (number | null)[]; desc: string };

/** Check whether a buffer starts with a given magic byte sequence. Null = wildcard. */
function matchesMagic(buf: Buffer, magic: (number | null)[]): boolean {
    if (buf.length < magic.length) return false;
    return magic.every((b, i) => b === null || buf[i] === b);
}

function checkMagic(buf: Buffer, signatures: MagicEntry[], errorType: string): void {
    const matched = signatures.some(sig => matchesMagic(buf, sig.bytes));
    if (!matched) {
        throw new Error(`Invalid ${errorType} file: content does not match any accepted format`);
    }
}

/** Audio magic byte signatures */
const AUDIO_SIGS: MagicEntry[] = [
    // OGG (OggS)
    { bytes: [0x4F, 0x67, 0x67, 0x53], desc: 'OGG' },
    // MP3 with ID3
    { bytes: [0x49, 0x44, 0x33], desc: 'MP3 ID3' },
    // MP3 frame sync (MPEG-1 Layer 3, various variants)
    { bytes: [0xFF, 0xFB], desc: 'MP3 sync' },
    { bytes: [0xFF, 0xF3], desc: 'MP3 sync' },
    { bytes: [0xFF, 0xF2], desc: 'MP3 sync' },
    { bytes: [0xFF, 0xFA], desc: 'MP3 sync' },
    { bytes: [0xFF, 0xF9], desc: 'MP3 sync' },
    // WAV (RIFF....WAVE)
    { bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x41, 0x56, 0x45], desc: 'WAV' },
    // FLAC
    { bytes: [0x66, 0x4C, 0x61, 0x43], desc: 'FLAC' },
    // M4A / AAC / MP4 audio (ftyp box — offset 4-7)
    { bytes: [null, null, null, null, 0x66, 0x74, 0x79, 0x70], desc: 'M4A/AAC' },
    // AIFF
    { bytes: [0x46, 0x4F, 0x52, 0x4D], desc: 'AIFF' },
];

/** Image magic byte signatures */
const IMAGE_SIGS: MagicEntry[] = [
    // JPEG
    { bytes: [0xFF, 0xD8, 0xFF], desc: 'JPEG' },
    // PNG
    { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], desc: 'PNG' },
    // GIF87a / GIF89a
    { bytes: [0x47, 0x49, 0x46, 0x38], desc: 'GIF' },
    // WebP (RIFF....WEBP)
    { bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], desc: 'WebP' },
];

/** Project file magic byte signatures — FL Studio .flp, ZIP-based archives */
const PROJECT_SIGS: MagicEntry[] = [
    // FL Studio .flp
    { bytes: [0x46, 0x4C, 0x68, 0x64], desc: 'FLP' },
    // ZIP (used by .als, .logicx zips, .dawproject, etc.)
    { bytes: [0x50, 0x4B, 0x03, 0x04], desc: 'ZIP' },
    // ZIP empty
    { bytes: [0x50, 0x4B, 0x05, 0x06], desc: 'ZIP' },
];

export class FileValidator {
    static validateAudio(buffer: Buffer, filename: string): void {
        if (buffer.length === 0) throw new Error('Audio file is empty');
        if (buffer.length > MAX_AUDIO_BYTES) {
            throw new Error(`Audio file exceeds maximum size of ${MAX_AUDIO_BYTES / 1024 / 1024}MB`);
        }
        checkMagic(buffer, AUDIO_SIGS, 'audio');
    }

    static validateImage(buffer: Buffer, filename: string): void {
        if (buffer.length === 0) throw new Error('Image file is empty');
        if (buffer.length > MAX_IMAGE_BYTES) {
            throw new Error(`Image file exceeds maximum size of ${MAX_IMAGE_BYTES / 1024 / 1024}MB`);
        }
        checkMagic(buffer, IMAGE_SIGS, 'image');
    }

    static validateProject(buffer: Buffer, filename: string): void {
        if (buffer.length === 0) throw new Error('Project file is empty');
        if (buffer.length > MAX_PROJECT_BYTES) {
            throw new Error(`Project file exceeds maximum size of ${MAX_PROJECT_BYTES / 1024 / 1024}MB`);
        }
        checkMagic(buffer, PROJECT_SIGS, 'project');
    }
}

/**
 * Sanitize a filename to prevent path traversal and OS-dangerous characters.
 * Strips directory components, null bytes, and shell-special characters.
 * Limits length to 200 characters.
 */
export function sanitizeFilename(filename: string): string {
    // Remove directory traversal components
    let name = filename.replace(/[/\\]/g, '_');
    // Remove null bytes and control characters
    name = name.replace(/[\x00-\x1F\x7F]/g, '');
    // Remove shell-special characters
    name = name.replace(/[`$|&;()<>'"!*?{}[\]#%^~]/g, '_');
    // Collapse multiple underscores/dots
    name = name.replace(/_+/g, '_').replace(/\.{2,}/g, '.');
    // Trim leading dots (hidden files on Unix)
    name = name.replace(/^\.+/, '');
    // Limit length
    if (name.length > 200) {
        const ext = name.lastIndexOf('.');
        if (ext > 0) {
            name = name.substring(0, 196) + name.substring(ext);
        } else {
            name = name.substring(0, 200);
        }
    }
    return name || 'file';
}
