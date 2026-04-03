-- AlterTable: add enabled column to radio_settings (was in schema but never migrated)
ALTER TABLE "radio_settings" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;
