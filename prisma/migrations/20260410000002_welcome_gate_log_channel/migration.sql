-- Add log channel for blocked unverified messages
ALTER TABLE "welcome_gate_settings" ADD COLUMN "logChannelId" TEXT;
