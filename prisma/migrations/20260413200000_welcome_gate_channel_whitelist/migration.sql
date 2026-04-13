-- Add channel whitelist to WelcomeGateSettings
ALTER TABLE "welcome_gate_settings" ADD COLUMN "whitelistedChannelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
