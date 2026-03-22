-- AlterTable: add featuredContentType to discovery_settings
ALTER TABLE "discovery_settings" ADD COLUMN IF NOT EXISTS "featured_content_type" TEXT NOT NULL DEFAULT 'video';
