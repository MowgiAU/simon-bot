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

/**
 * Map of Unicode fancy-text ranges to their ASCII equivalents.
 * Covers Mathematical Bold, Italic, Script, Fraktur, Double-Struck,
 * Sans-Serif, Monospace, Fullwidth, Circled, Regional Indicator, and other
 * decorative substitution alphabets commonly abused in display names.
 */
const UNICODE_LETTER_MAP: Array<[number, number, number]> = [
    // Mathematical Bold A-Z / a-z
    [0x1D400, 0x1D419, 0x41], [0x1D41A, 0x1D433, 0x61],
    // Mathematical Italic A-Z / a-z
    [0x1D434, 0x1D44D, 0x41], [0x1D44E, 0x1D467, 0x61],
    // Mathematical Bold Italic A-Z / a-z
    [0x1D468, 0x1D481, 0x41], [0x1D482, 0x1D49B, 0x61],
    // Mathematical Script A-Z / a-z
    [0x1D49C, 0x1D4B5, 0x41], [0x1D4B6, 0x1D4CF, 0x61],
    // Mathematical Bold Script A-Z / a-z
    [0x1D4D0, 0x1D4E9, 0x41], [0x1D4EA, 0x1D503, 0x61],
    // Mathematical Fraktur A-Z / a-z
    [0x1D504, 0x1D51D, 0x41], [0x1D51E, 0x1D537, 0x61],
    // Mathematical Double-Struck A-Z / a-z
    [0x1D538, 0x1D551, 0x41], [0x1D552, 0x1D56B, 0x61],
    // Mathematical Bold Fraktur A-Z / a-z
    [0x1D56C, 0x1D585, 0x41], [0x1D586, 0x1D59F, 0x61],
    // Mathematical Sans-Serif A-Z / a-z
    [0x1D5A0, 0x1D5B9, 0x41], [0x1D5BA, 0x1D5D3, 0x61],
    // Mathematical Sans-Serif Bold A-Z / a-z
    [0x1D5D4, 0x1D5ED, 0x41], [0x1D5EE, 0x1D607, 0x61],
    // Mathematical Sans-Serif Italic A-Z / a-z
    [0x1D608, 0x1D621, 0x41], [0x1D622, 0x1D63B, 0x61],
    // Mathematical Sans-Serif Bold Italic A-Z / a-z
    [0x1D63C, 0x1D655, 0x41], [0x1D656, 0x1D66F, 0x61],
    // Mathematical Monospace A-Z / a-z
    [0x1D670, 0x1D689, 0x41], [0x1D68A, 0x1D6A3, 0x61],
    // Mathematical Bold digits 0-9
    [0x1D7CE, 0x1D7D7, 0x30],
    // Mathematical Double-Struck digits 0-9
    [0x1D7D8, 0x1D7E1, 0x30],
    // Mathematical Sans-Serif digits 0-9
    [0x1D7E2, 0x1D7EB, 0x30],
    // Mathematical Sans-Serif Bold digits 0-9
    [0x1D7EC, 0x1D7F5, 0x30],
    // Mathematical Monospace digits 0-9
    [0x1D7F6, 0x1D7FF, 0x30],
    // Fullwidth A-Z / a-z / 0-9
    [0xFF21, 0xFF3A, 0x41], [0xFF41, 0xFF5A, 0x61], [0xFF10, 0xFF19, 0x30],
    // Circled A-Z / a-z
    [0x24B6, 0x24CF, 0x41], [0x24D0, 0x24E9, 0x61],
    // Regional Indicator Symbols A-Z (flag letters)
    [0x1F1E6, 0x1F1FF, 0x41],
    // Negative Circled A-Z
    [0x1F150, 0x1F169, 0x41],
    // Negative Squared A-Z
    [0x1F170, 0x1F189, 0x41],
    // Squared A-Z
    [0x1F130, 0x1F149, 0x41],
];

/**
 * Normalise a user-facing display name (track title, artist name, etc.).
 * Converts decorative Unicode alphabets back to plain ASCII equivalents,
 * strips invisible / zero-width characters, and collapses whitespace.
 * Preserves normal international characters (accents, CJK, etc.).
 */
export function sanitizeDisplayName(input: string, maxLength: number = 100): string {
    // First pass: NFKC normalization catches many fullwidth / compatibility forms
    let text = input.normalize('NFKC');

    // Second pass: convert remaining fancy math/decorative letters to ASCII
    const codePoints = [...text];
    const result: string[] = [];
    for (const ch of codePoints) {
        const cp = ch.codePointAt(0)!;
        let mapped = false;
        for (const [start, end, base] of UNICODE_LETTER_MAP) {
            if (cp >= start && cp <= end) {
                result.push(String.fromCharCode(base + (cp - start)));
                mapped = true;
                break;
            }
        }
        if (!mapped) {
            result.push(ch);
        }
    }
    text = result.join('');

    // Strip zero-width and invisible characters
    text = text.replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF\uFFF9-\uFFFB]/g, '');
    // Strip combining diacritical marks that are used purely for "zalgo" effects (U+0300-U+036F)
    // Keep basic combining accents if the preceding char is a normal letter
    // Remove variation selectors (U+FE00-U+FE0F, U+E0100-U+E01EF)
    text = text.replace(/[\uFE00-\uFE0F]/g, '');

    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Enforce max length
    if (maxLength && text.length > maxLength) {
        text = text.substring(0, maxLength).trimEnd();
    }

    return text || 'Untitled';
}
