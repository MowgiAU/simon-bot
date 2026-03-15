import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { PrismaClient } from '@prisma/client';
import { FLPParser } from '../bot/utils/FLPParser.js';
import { MediaConverter } from './MediaConverter.js';
import { WaveformExtractor } from './WaveformExtractor.js';
import { R2Storage } from './R2Storage.js';
import { Logger } from '../bot/utils/logger.js';

const logger = new Logger('ProjectZipProcessor');

// Directory that serves local sample files when R2 is not configured.
const LOCAL_SAMPLES_DIR = path.join(process.cwd(), 'uploads', 'samples');

export interface ProcessResult {
    /** Arrangement JSON enriched with per-audio-clip { oggUrl, peaks, duration } */
    arrangement: any;
    sampleCount: number;
}

export class ProjectZipProcessor {
    /**
     * Process an FL Studio project ZIP:
     *  1. Extract to a temp dir
     *  2. Locate the .flp file and parse it
     *  3. For every audio clip: convert to OGG, extract waveform peaks
     *  4. Upload to Cloudflare R2 (or serve locally if R2 not configured)
     *  5. Upsert TrackSample rows in the DB
     *  6. Return enriched arrangement JSON + sample count
     *
     * The temp dir is always cleaned up in the finally block.
     */
    static async process(
        zipPath: string,
        trackId: string,
        db: PrismaClient,
    ): Promise<ProcessResult> {
        const tempDir = path.join(process.cwd(), 'uploads', 'tmp', `zip_${trackId}_${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        try {
            // ── Step 1: Extract ZIP ────────────────────────────────────────────
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(tempDir, /* overwrite */ true);
            logger.info(`Extracted ZIP to ${tempDir}`);

            // ── Step 2: Find .flp file ─────────────────────────────────────────
            const flpPath = findFlp(tempDir);
            if (!flpPath) {
                throw new Error('No .flp file found inside the uploaded ZIP');
            }

            // ── Step 3: Parse FLP ──────────────────────────────────────────────
            const flpBuffer = fs.readFileSync(flpPath);
            const arrangement = FLPParser.parse(flpBuffer) as any;

            // Build a lookup map: lowercase-basename → absolute path of extracted audio
            const audioFileMap = buildAudioFileMap(tempDir);

            // ── Step 4-6: Process each UNIQUE sample, then enrich all clips ──────
            let sampleCount = 0;
            const clips: any[] = arrangement?.tracks?.flatMap((t: any) => t.clips ?? []) ?? [];

            // Deduplicate: collect unique sample filenames referenced by audio clips
            const uniqueSamples = new Map<string, string>(); // baseName → srcPath
            for (const clip of clips) {
                if (clip.type !== 'audio' || !clip.sampleFileName) continue;
                const baseName = clip.sampleFileName;
                if (uniqueSamples.has(baseName)) continue;
                const srcPath = audioFileMap.get(baseName.toLowerCase());
                if (srcPath) {
                    uniqueSamples.set(baseName, srcPath);
                } else {
                    logger.warn(`ZIP missing sample for clip: ${baseName} – skipping`);
                }
            }

            // Process each unique sample exactly once
            const sampleCache = new Map<string, { oggUrl: string; peaks: number[]; duration: number | null }>();

            for (const [baseName, srcPath] of uniqueSamples) {
                try {
                    // Copy to a working temp path so we don't corrupt the extracted tree
                    const workPath = path.join(tempDir, `work_${Date.now()}_${baseName}`);
                    fs.copyFileSync(srcPath, workPath);

                    // Convert to OGG
                    const oggPath = await MediaConverter.convertToOgg(workPath);

                    // Extract waveform peaks
                    const peaks = await WaveformExtractor.extractPeaks(oggPath);

                    // Duration
                    let duration: number | null = null;
                    try {
                        duration = await getDurationSeconds(oggPath);
                    } catch { /* non-fatal */ }

                    // Upload or serve locally
                    let oggUrl: string;
                    if (R2Storage.isConfigured()) {
                        const oggBuffer = fs.readFileSync(oggPath);
                        // Key format: tracks/{trackId}/samples/filename.ogg
                        const key = `tracks/${trackId}/samples/${path.basename(baseName, path.extname(baseName))}.ogg`;
                        oggUrl = await R2Storage.uploadBuffer(key, oggBuffer, 'audio/ogg');
                    } else {
                        // Serve from local uploads/samples/{trackId}/
                        const localDir = path.join(LOCAL_SAMPLES_DIR, trackId);
                        fs.mkdirSync(localDir, { recursive: true });
                        const localFilename =
                            path.basename(baseName, path.extname(baseName)) + '.ogg';
                        const localPath = path.join(localDir, localFilename);
                        fs.copyFileSync(oggPath, localPath);
                        oggUrl = `/uploads/samples/${trackId}/${localFilename}`;
                        logger.info(`R2 not configured – sample saved locally: ${oggUrl}`);
                    }

                    // Cleanup OGG work file
                    if (fs.existsSync(oggPath)) {
                        try { fs.unlinkSync(oggPath); } catch { /* non-fatal */ }
                    }

                    // Upsert DB row
                    await db.trackSample.upsert({
                        where: { trackId_originalFilename: { trackId, originalFilename: baseName } },
                        create: { trackId, originalFilename: baseName, oggUrl, peaks, duration },
                        update: { oggUrl, peaks, duration },
                    });

                    sampleCache.set(baseName, { oggUrl, peaks, duration });
                    sampleCount++;
                } catch (err: any) {
                    logger.warn(`Failed to process sample ${baseName}: ${err.message}`);
                    // Continue — partial results are better than a complete failure
                }
            }

            // Enrich all clips from cache (no reprocessing)
            for (const clip of clips) {
                if (clip.type !== 'audio' || !clip.sampleFileName) continue;
                const cached = sampleCache.get(clip.sampleFileName);
                if (cached) {
                    clip.oggUrl = cached.oggUrl;
                    clip.peaks = cached.peaks;
                    clip.duration = cached.duration;
                }
            }

            logger.info(`ProjectZipProcessor: processed ${sampleCount} samples for track ${trackId}`);
            return { arrangement, sampleCount };
        } finally {
            // Always clean up the temp extraction dir
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (e) {
                logger.warn(`Failed to clean up temp dir ${tempDir}: ${e}`);
            }
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Recursively walk `dir` and return a Map of lowercase-basename → absolute path
 *  for all common audio extensions. */
function buildAudioFileMap(dir: string): Map<string, string> {
    const AUDIO_EXTS = new Set(['.wav', '.mp3', '.flac', '.aif', '.aiff', '.ogg', '.m4a']);
    const map = new Map<string, string>();

    function walk(current: string) {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (AUDIO_EXTS.has(path.extname(entry.name).toLowerCase())) {
                map.set(entry.name.toLowerCase(), fullPath);
            }
        }
    }

    walk(dir);
    return map;
}

/** Return the first .flp file found (depth-first) under `dir`, or null. */
function findFlp(dir: string): string | null {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const found = findFlp(fullPath);
            if (found) return found;
        } else if (path.extname(entry.name).toLowerCase() === '.flp') {
            return fullPath;
        }
    }
    return null;
}

/** Use FFmpeg to read the duration of an audio file. */
function getDurationSeconds(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        // Lazy-import to avoid circular dep at module load
        import('fluent-ffmpeg').then(({ default: ffmpeg }) => {
            ffmpeg.ffprobe(filePath, (err, meta) => {
                if (err) return reject(err);
                const dur = meta?.format?.duration;
                if (dur != null) resolve(dur);
                else reject(new Error('No duration in ffprobe output'));
            });
        });
    });
}
