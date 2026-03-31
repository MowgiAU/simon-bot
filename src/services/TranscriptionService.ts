/**
 * TranscriptionService — Uses OpenAI Whisper API to transcribe voice segments.
 *
 * Downloads the OGG audio from R2 CDN, sends to Whisper, and stores
 * the transcript text back on the VoiceSegment record.
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // Whisper API limit is 25MB

export class TranscriptionService {
    private openai: OpenAI;
    private db: PrismaClient;

    constructor(db: PrismaClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY is required for transcription');
        this.openai = new OpenAI({ apiKey });
        this.db = db;
    }

    /**
     * Transcribe a single voice segment by ID.
     * Returns the transcript text, or null if it fails.
     */
    async transcribeSegment(segmentId: string): Promise<string | null> {
        const segment = await this.db.voiceSegment.findUnique({ where: { id: segmentId } });
        if (!segment) throw new Error(`Segment ${segmentId} not found`);

        // Don't re-transcribe if already done
        if (segment.transcriptStatus === 'done' && segment.transcript) {
            return segment.transcript;
        }

        // Mark as pending
        await this.db.voiceSegment.update({
            where: { id: segmentId },
            data: { transcriptStatus: 'pending' },
        });

        try {
            // Download audio from CDN
            const response = await fetch(segment.r2Url);
            if (!response.ok) {
                throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            if (buffer.length > MAX_FILE_SIZE) {
                throw new Error(`Audio file too large for Whisper API (${(buffer.length / 1024 / 1024).toFixed(1)}MB > 25MB)`);
            }

            if (buffer.length < 1000) {
                // Tiny file — likely too short for useful transcription
                await this.db.voiceSegment.update({
                    where: { id: segmentId },
                    data: { transcript: '', transcriptStatus: 'done' },
                });
                return '';
            }

            // Send to Whisper
            const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' });
            const transcription = await this.openai.audio.transcriptions.create({
                model: 'whisper-1',
                file,
                response_format: 'text',
            });

            const text = (typeof transcription === 'string' ? transcription : (transcription as any).text || '').trim();

            // Store result
            await this.db.voiceSegment.update({
                where: { id: segmentId },
                data: { transcript: text, transcriptStatus: 'done' },
            });

            return text;
        } catch (err: any) {
            // Mark as error
            await this.db.voiceSegment.update({
                where: { id: segmentId },
                data: { transcriptStatus: 'error' },
            });
            throw err;
        }
    }
}
