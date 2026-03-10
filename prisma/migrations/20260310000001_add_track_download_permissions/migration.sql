-- Add per-track download permission fields to musician_tracks table
-- Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS for idempotency

ALTER TABLE "musician_tracks" ADD COLUMN IF NOT EXISTS "allowAudioDownload" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "musician_tracks" ADD COLUMN IF NOT EXISTS "allowProjectDownload" BOOLEAN NOT NULL DEFAULT true;
