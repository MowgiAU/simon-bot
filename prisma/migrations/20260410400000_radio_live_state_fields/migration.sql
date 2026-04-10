-- Add live state fields to radio_settings for dashboard now-playing accuracy
ALTER TABLE "radio_settings" ADD COLUMN "is_online" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "radio_settings" ADD COLUMN "station_status" TEXT NOT NULL DEFAULT '';
ALTER TABLE "radio_settings" ADD COLUMN "current_track_title" TEXT;
ALTER TABLE "radio_settings" ADD COLUMN "current_artist_name" TEXT;
ALTER TABLE "radio_settings" ADD COLUMN "current_cover_url" TEXT;
ALTER TABLE "radio_settings" ADD COLUMN "current_duration" INTEGER;
ALTER TABLE "radio_settings" ADD COLUMN "current_started_at" TIMESTAMP(3);
ALTER TABLE "radio_settings" ADD COLUMN "current_listeners" INTEGER NOT NULL DEFAULT 0;
