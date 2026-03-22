-- Add author and date fields to discovery_settings for featured tutorial card
ALTER TABLE "discovery_settings" ADD COLUMN IF NOT EXISTS "featured_tutorial_author" TEXT;
ALTER TABLE "discovery_settings" ADD COLUMN IF NOT EXISTS "featured_tutorial_date" TEXT;
