-- Add pendingRefresh flag to voice_stat_settings for cross-process IPC
ALTER TABLE "voice_stat_settings" ADD COLUMN "pendingRefresh" BOOLEAN NOT NULL DEFAULT false;
