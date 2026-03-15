import fs from 'fs';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Logger } from '../bot/utils/logger.js';

const logger = new Logger('WaveformExtractor');

/**
 * Extract normalised RMS waveform peaks from an audio file using FFmpeg.
 *
 * The audio is decoded to mono 8000 Hz signed 16-bit PCM via stdout,
 * chunked into `numPeaks` equal blocks, and each block's RMS amplitude
 * is normalised to the range 0.0 – 1.0.
 */
export class WaveformExtractor {
    static async extractPeaks(inputPath: string, numPeaks: number = 1200): Promise<number[]> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];

            const proc = spawn(ffmpegInstaller.path, [
                '-i', inputPath,
                '-ac', '1',       // mono
                '-ar', '8000',    // 8 kHz — enough for envelope shape
                '-f', 's16le',    // raw signed 16-bit little-endian PCM
                '-vn',            // no video
                'pipe:1',
            ], { stdio: ['ignore', 'pipe', 'ignore'] });

            proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));

            proc.on('error', (err) => {
                logger.warn(`WaveformExtractor spawn error for ${inputPath}: ${err.message}`);
                reject(err);
            });

            proc.on('close', (code) => {
                if (code !== 0 && chunks.length === 0) {
                    reject(new Error(`FFmpeg exited with code ${code} and produced no output`));
                    return;
                }

                const pcm = Buffer.concat(chunks);
                // Each sample is 2 bytes (s16le)
                const totalSamples = Math.floor(pcm.length / 2);

                if (totalSamples === 0) {
                    resolve(new Array(numPeaks).fill(0));
                    return;
                }

                const blockSize = Math.max(1, Math.floor(totalSamples / numPeaks));
                const peaks: number[] = [];
                let maxRms = 0;

                // First pass: compute raw RMS for each block
                const rawRms: number[] = [];
                for (let i = 0; i < numPeaks; i++) {
                    const start = i * blockSize * 2;
                    const end = Math.min(start + blockSize * 2, pcm.length);
                    let sumSq = 0;
                    let count = 0;
                    for (let j = start; j < end - 1; j += 2) {
                        // Read as signed 16-bit little-endian
                        let sample = pcm.readInt16LE(j);
                        sumSq += sample * sample;
                        count++;
                    }
                    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
                    rawRms.push(rms);
                    if (rms > maxRms) maxRms = rms;
                }

                // Second pass: normalise to 0–1
                for (const rms of rawRms) {
                    peaks.push(maxRms > 0 ? parseFloat((rms / maxRms).toFixed(4)) : 0);
                }

                resolve(peaks);
            });
        });
    }
}
