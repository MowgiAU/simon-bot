/**
 * FileValidator — Security-hardened file upload validation.
 *
 * Validates uploads by checking:
 *   1. Magic bytes (file signatures) — not just MIME or extension
 *   2. File size limits per category
 *   3. Filename sanitisation (strips path traversal, null bytes, control chars)
 *   4. Extension whitelist per field type
 *
 * Usage:
 *   import { FileValidator, sanitizeFilename } from '../services/FileValidator.js';
 *   FileValidator.validateAudio(buffer);   // throws on invalid
 *   FileValidator.validateImage(buffer);
 *   FileValidator.validateProject(buffer, originalname);
 */

import path from 'node:path';

// ── Magic Byte Signatures ──────────────────────────────────────────────────

interface MagicSignature {
    /** Human label */
    name: string;
    /** Byte pattern at the given offset */
    bytes: number[];
    /** Byte offset where the signature starts (default 0) */
    offset?: number;
}

const AUDIO_SIGNATURES: MagicSignature[] = [
    // MP3 — ID3 tag or sync word
    { name: 'MP3-ID3', bytes: [0x49, 0x44, 0x33] },               // "ID3"
    { name: 'MP3-sync', bytes: [0xFF, 0xFB] },                     // MPEG sync (MPEG1 Layer3)
    { name: 'MP3-sync2', bytes: [0xFF, 0xF3] },                    // MPEG2 Layer3
    { name: 'MP3-sync3', bytes: [0xFF, 0xF2] },                    // MPEG2.5 Layer3
    // WAV — "RIFF" + "WAVE"
    { name: 'WAV', bytes: [0x52, 0x49, 0x46, 0x46] },             // "RIFF" header
    // FLAC
    { name: 'FLAC', bytes: [0x66, 0x4C, 0x61, 0x43] },            // "fLaC"
    // OGG Vorbis / Opus
    { name: 'OGG', bytes: [0x4F, 0x67, 0x67, 0x53] },             // "OggS"
    // AAC (ADTS)
    { name: 'AAC', bytes: [0xFF, 0xF1] },
    { name: 'AAC2', bytes: [0xFF, 0xF9] },
    // M4A/MP4 — ftyp box
    { name: 'M4A', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },  // "ftyp" at offset 4
    // AIFF
    { name: 'AIFF', bytes: [0x46, 0x4F, 0x52, 0x4D] },            // "FORM"
    // WebM
    { name: 'WebM', bytes: [0x1A, 0x45, 0xDF, 0xA3] },            // EBML header
];

const IMAGE_SIGNATURES: MagicSignature[] = [
    { name: 'PNG', bytes: [0x89, 0x50, 0x4E, 0x47] },             // "\x89PNG"
    { name: 'JPEG', bytes: [0xFF, 0xD8, 0xFF] },                    // JPEG SOI
    { name: 'GIF87a', bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
    { name: 'GIF89a', bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
    { name: 'WebP', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP" at offset 8
    { name: 'BMP', bytes: [0x42, 0x4D] },                          // "BM"
    { name: 'AVIF', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // AVIF uses "ftyp" too
];

const PROJECT_SIGNATURES: MagicSignature[] = [
    // FL Studio project — starts with "FLhd"
    { name: 'FLP', bytes: [0x46, 0x4C, 0x68, 0x64] },             // "FLhd"
    // ZIP archive (for .zip bundles)
    { name: 'ZIP', bytes: [0x50, 0x4B, 0x03, 0x04] },             // "PK\x03\x04"
    { name: 'ZIP-empty', bytes: [0x50, 0x4B, 0x05, 0x06] },       // Empty ZIP
];

// ── Per-category size limits ───────────────────────────────────────────────

export const SIZE_LIMITS = {
    audio: 300 * 1024 * 1024,      // 300 MB (WAV files)
    image: 10 * 1024 * 1024,       // 10 MB
    project: 500 * 1024 * 1024,    // 500 MB (ZIP bundles can be large)
    avatar: 5 * 1024 * 1024,       //  5 MB
} as const;

// ── Extension whitelists ───────────────────────────────────────────────────

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a', '.aiff', '.aif', '.wma', '.webm', '.opus']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif']);
const PROJECT_EXTENSIONS = new Set(['.flp', '.zip']);

// ── Helpers ────────────────────────────────────────────────────────────────

function matchesMagic(buffer: Buffer, signatures: MagicSignature[]): MagicSignature | null {
    for (const sig of signatures) {
        const offset = sig.offset ?? 0;
        if (buffer.length < offset + sig.bytes.length) continue;
        let match = true;
        for (let i = 0; i < sig.bytes.length; i++) {
            if (buffer[offset + i] !== sig.bytes[i]) { match = false; break; }
        }
        if (match) return sig;
    }
    return null;
}

// ── Public API ─────────────────────────────────────────────────────────────

export class FileValidator {
    /**
     * Validate an audio upload. Reads the first bytes to confirm magic signature.
     * @throws Error if invalid
     */
    static validateAudio(buffer: Buffer, originalname: string): void {
        const ext = path.extname(originalname).toLowerCase();
        if (!AUDIO_EXTENSIONS.has(ext)) {
            throw new Error(`Audio extension "${ext}" is not allowed. Permitted: ${[...AUDIO_EXTENSIONS].join(', ')}`);
        }
        if (buffer.length > SIZE_LIMITS.audio) {
            throw new Error(`Audio file exceeds ${SIZE_LIMITS.audio / 1024 / 1024}MB limit`);
        }
        const sig = matchesMagic(buffer, AUDIO_SIGNATURES);
        if (!sig) {
            throw new Error('Audio file has an invalid or unrecognised file signature. The file may be corrupted or mislabelled.');
        }
    }

    /**
     * Validate an image upload.
     */
    static validateImage(buffer: Buffer, originalname: string): void {
        const ext = path.extname(originalname).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) {
            throw new Error(`Image extension "${ext}" is not allowed. Permitted: ${[...IMAGE_EXTENSIONS].join(', ')}`);
        }
        const limit = SIZE_LIMITS.image;
        if (buffer.length > limit) {
            throw new Error(`Image file exceeds ${limit / 1024 / 1024}MB limit`);
        }
        const sig = matchesMagic(buffer, IMAGE_SIGNATURES);
        if (!sig) {
            throw new Error('Image file has an invalid file signature. Only PNG, JPEG, GIF, WebP, BMP, and AVIF are accepted.');
        }
    }

    /**
     * Validate a project upload (.flp or .zip).
     */
    static validateProject(buffer: Buffer, originalname: string): void {
        const ext = path.extname(originalname).toLowerCase();
        if (!PROJECT_EXTENSIONS.has(ext)) {
            throw new Error(`Project file extension "${ext}" is not allowed. Only .flp and .zip are accepted.`);
        }
        if (buffer.length > SIZE_LIMITS.project) {
            throw new Error(`Project file exceeds ${SIZE_LIMITS.project / 1024 / 1024}MB limit`);
        }
        const sig = matchesMagic(buffer, PROJECT_SIGNATURES);
        if (!sig) {
            throw new Error('Project file has an invalid file signature. Expected FL Studio (.flp) or ZIP archive.');
        }
    }
}

/**
 * Sanitize a user-supplied filename:
 * - Strip directory components (path traversal)
 * - Remove null bytes and control characters
 * - Collapse whitespace
 * - Limit length
 */
export function sanitizeFilename(raw: string): string {
    let name = path.basename(raw);                         // Strip path components
    name = name.replace(/[\x00-\x1f\x7f]/g, '');         // Remove control chars + null bytes
    name = name.replace(/[<>:"|?*\\]/g, '_');             // Remove FS-unsafe characters
    name = name.replace(/\.{2,}/g, '.');                  // Collapse consecutive dots
    name = name.trim().replace(/\s+/g, '_');              // Whitespace → underscore
    if (name.length > 200) {
        const ext = path.extname(name);
        name = name.slice(0, 200 - ext.length) + ext;
    }
    return name || 'unnamed';
}
