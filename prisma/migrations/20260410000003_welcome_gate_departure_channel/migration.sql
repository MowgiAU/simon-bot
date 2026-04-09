-- Add departure channel for member leave announcements
ALTER TABLE "welcome_gate_settings" ADD COLUMN "departureChannelId" TEXT;
