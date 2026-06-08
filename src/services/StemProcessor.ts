import path from 'path';
import fs from 'fs';
import { MediaConverter } from './MediaConverter.js';
import { WaveformExtractor } from './WaveformExtractor.js';
import { R2Storage } from './R2Storage.js';
import { Logger } from '../bot/utils/logger.js';

const logger = new Logger('StemProcessor');

const LOCAL_STEMS_DIR = path.join(process.cwd(), 'uploads', 'stems');

export interface ProcessedStem {
    label: string;
    originalFilename: string;
    url: string;
    mp3Url: string | null;
    peaks: number[] | null;
    duration: number | null;
}

/**
 * Converts an uploaded raw stem audio file to OGG Opus (+ MP3 fallback),
 * extracts waveform peaks, and uploads both to R2 (or serves locally).
 *
 * The raw file at `rawPath` is consumed (deleted) by the OGG conversion step,
 * mirroring the main track-upload pipeline in src/api/index.ts.
 */
export class StemProcessor {
    static async process(rawPath: string, originalFilename: string, label: string, trackId: string): Promise<ProcessedStem> {
        const oggPath = await MediaConverter.convertToOgg(rawPath);

        let peaks: number[] | null = null;
        try {
            peaks = await WaveformExtractor.extractPeaks(oggPath, 1200);
        } catch (e: any) {
            logger.warn(`Peak extraction failed for stem "${originalFilename}": ${e.message}`);
        }

        let duration: number | null = null;
        try {
            duration = await getDurationSeconds(oggPath);
        } catch { /* non-fatal */ }

        let mp3Path: string | null = null;
        try {
            mp3Path = await MediaConverter.convertToMp3(oggPath);
        } catch (e: any) {
            logger.warn(`MP3 fallback conversion failed for stem "${originalFilename}": ${e.message}`);
        }

        const baseName = path.basename(originalFilename, path.extname(originalFilename))
            .replace(/[^a-zA-Z0-9_-]/g, '_');
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

        const url = await uploadOrServeLocally(oggPath, `tracks/${trackId}/stems/${baseName}-${unique}.ogg`,
            'audio/ogg', `${baseName}-${unique}.ogg`, trackId);

        let mp3Url: string | null = null;
        if (mp3Path) {
            mp3Url = await uploadOrServeLocally(mp3Path, `tracks/${trackId}/stems/${baseName}-${unique}.mp3`,
                'audio/mpeg', `${baseName}-${unique}.mp3`, trackId);
        }

        return { label, originalFilename, url, mp3Url, peaks, duration };
    }
}

async function uploadOrServeLocally(
    localFilePath: string,
    r2Key: string,
    contentType: string,
    localFilename: string,
    trackId: string,
): Promise<string> {
    if (R2Storage.isConfigured()) {
        try {
            const buffer = fs.readFileSync(localFilePath);
            const cdnUrl = await R2Storage.uploadBuffer(r2Key, buffer, contentType);
            try { fs.unlinkSync(localFilePath); } catch {}
            return cdnUrl;
        } catch (err) {
            logger.warn(`R2 upload failed for key "${r2Key}", serving from local: ${err}`);
        }
    }

    const localDir = path.join(LOCAL_STEMS_DIR, trackId);
    fs.mkdirSync(localDir, { recursive: true });
    const destPath = path.join(localDir, localFilename);
    fs.renameSync(localFilePath, destPath);
    return `/uploads/stems/${trackId}/${localFilename}`;
}

function getDurationSeconds(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
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
