import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import { Logger } from '../bot/utils/logger.js';

// Prefer a system-installed FFmpeg (set via FFMPEG_PATH env var on the server)
// so we get full codec support (libopus etc.) instead of the bundled minimal build.
ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegInstaller.path);

const logger = new Logger('MediaConverter');

export class MediaConverter {
    /**
     * Converts any audio file to 320kbps MP3.
     * Returns the path of the converted file.
     * On failure, returns the original path unchanged.
     */
    static async convertAudio(inputPath: string): Promise<string> {
        const base = inputPath.replace(/\.[^.]+$/, '');
        const outputPath = base + '.mp3';
        // Write to a temp file first to avoid input/output collision when input is already .mp3
        const tempOutputPath = base + '._converting.mp3';

        // If already an MP3, skip re-encoding (avoids expensive ffmpeg passthrough)
        if (inputPath.toLowerCase().endsWith('.mp3') && inputPath !== outputPath) {
            try {
                fs.renameSync(inputPath, outputPath);
                logger.info(`Audio already MP3, skipped re-encoding: ${path.basename(outputPath)}`);
                return outputPath;
            } catch (e) {
                logger.warn(`MP3 rename failed, will re-encode: ${e}`);
            }
        }

        return new Promise((resolve) => {
            ffmpeg(inputPath)
                .audioCodec('libmp3lame')
                .audioBitrate('320k')
                .noVideo()
                .output(tempOutputPath)
                .on('end', () => {
                    try {
                        // Remove the original (may differ from outputPath extension)
                        if (fs.existsSync(inputPath) && inputPath !== tempOutputPath) {
                            fs.unlinkSync(inputPath);
                        }
                        // Rename temp → final
                        if (fs.existsSync(tempOutputPath)) {
                            fs.renameSync(tempOutputPath, outputPath);
                        }
                        logger.info(`Audio converted to 320kbps MP3: ${path.basename(outputPath)}`);
                        resolve(outputPath);
                    } catch (e) {
                        logger.warn(`Post-conversion file ops failed: ${e}`);
                        resolve(tempOutputPath); // still return something valid
                    }
                })
                .on('error', (err) => {
                    logger.warn(`Audio conversion failed for ${path.basename(inputPath)}: ${err.message}`);
                    // Clean up temp if it exists
                    if (fs.existsSync(tempOutputPath)) {
                        try { fs.unlinkSync(tempOutputPath); } catch {}
                    }
                    resolve(inputPath); // Return original on failure
                })
                .run();
        });
    }

    /**
     * Converts any audio file to OGG Opus (128kbps) for efficient web delivery.
     * Uses libopus which provides ~90% size reduction vs WAV at comparable quality.
     * Returns the path of the converted .ogg file.
     * On failure, returns the original path unchanged.
     */
    static async convertToOgg(inputPath: string): Promise<string> {
        const base = inputPath.replace(/\.[^.]+$/, '');
        const outputPath = base + '.ogg';
        const tempOutputPath = base + '._converting.ogg';

        return new Promise((resolve) => {
            ffmpeg(inputPath)
                .audioCodec('libopus')
                .audioBitrate('128k')
                .noVideo()
                .output(tempOutputPath)
                .on('end', () => {
                    try {
                        if (fs.existsSync(inputPath) && inputPath !== tempOutputPath) {
                            fs.unlinkSync(inputPath);
                        }
                        if (fs.existsSync(tempOutputPath)) {
                            fs.renameSync(tempOutputPath, outputPath);
                        }
                        logger.info(`Audio converted to OGG Opus 128k: ${path.basename(outputPath)}`);
                        resolve(outputPath);
                    } catch (e) {
                        logger.warn(`Post-conversion file ops failed (ogg): ${e}`);
                        resolve(tempOutputPath);
                    }
                })
                .on('error', (err) => {
                    logger.warn(`OGG conversion failed for ${path.basename(inputPath)}: ${err.message}`);
                    if (fs.existsSync(tempOutputPath)) {
                        try { fs.unlinkSync(tempOutputPath); } catch {}
                    }
                    resolve(inputPath);
                })
                .run();
        });
    }

    /**
     * Optimizes an image file to WebP format (quality 82, max 2000x2000).
     * Returns the path of the converted file.
     * On failure, returns the original path unchanged.
     */
    static async optimizeImage(inputPath: string): Promise<string> {
        const outputPath = inputPath.replace(/\.[^.]+$/, '.webp');

        try {
            if (inputPath === outputPath) {
                // Input is already .webp — re-encode via temp to avoid in-place conflict
                const tempPath = inputPath + '.tmp';
                await sharp(inputPath)
                    .rotate() // auto-rotate based on EXIF
                    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 82 })
                    .toFile(tempPath);
                fs.renameSync(tempPath, outputPath);
            } else {
                await sharp(inputPath)
                    .rotate()
                    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 82 })
                    .toFile(outputPath);
                fs.unlinkSync(inputPath);
            }

            logger.info(`Image optimized to WebP: ${path.basename(outputPath)}`);
            return outputPath;
        } catch (err: any) {
            logger.warn(`Image optimization failed for ${path.basename(inputPath)}: ${err.message}`);
            return inputPath; // Return original on failure
        }
    }
}
