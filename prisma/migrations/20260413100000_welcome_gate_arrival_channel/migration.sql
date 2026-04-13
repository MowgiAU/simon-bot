-- Add arrival channel to WelcomeGateSettings
ALTER TABLE "welcome_gate_settings" ADD COLUMN "arrivalChannelId" TEXT;
