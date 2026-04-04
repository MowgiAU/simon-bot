-- Add command role permission fields to radio_settings
ALTER TABLE "radio_settings" ADD COLUMN IF NOT EXISTS "startRoleIds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "radio_settings" ADD COLUMN IF NOT EXISTS "stopRoleIds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "radio_settings" ADD COLUMN IF NOT EXISTS "skipRoleIds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "radio_settings" ADD COLUMN IF NOT EXISTS "hostRoleIds" TEXT[] NOT NULL DEFAULT '{}';
