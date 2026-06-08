-- AlterTable: add per-track stems download permission toggle (mirrors allowAudioDownload/allowProjectDownload)
ALTER TABLE "musician_tracks" ADD COLUMN "allowStemsDownload" BOOLEAN NOT NULL DEFAULT true;
