-- AlterTable: Add transcript fields to voice_segments
ALTER TABLE "voice_segments" ADD COLUMN "transcript" TEXT;
ALTER TABLE "voice_segments" ADD COLUMN "transcriptStatus" TEXT NOT NULL DEFAULT 'none';
