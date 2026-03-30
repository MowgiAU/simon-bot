-- Add soft-delete column (deletedAt) to critical tables
-- These columns are nullable so existing rows are unaffected.

ALTER TABLE "users"            ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "musician_profiles" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "musician_tracks"  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "beat_battles"     ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "battle_entries"   ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "tickets"          ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "comments"         ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "playlists"        ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Partial indexes for fast queries that exclude soft-deleted rows
CREATE INDEX IF NOT EXISTS "idx_users_active"    ON "users"("deletedAt")    WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_profiles_active" ON "musician_profiles"("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_tracks_active"   ON "musician_tracks"("deletedAt")  WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_battles_active"  ON "beat_battles"("deletedAt")     WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_entries_active"   ON "battle_entries"("deletedAt")  WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_tickets_active"  ON "tickets"("deletedAt")          WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_comments_active" ON "comments"("deletedAt")         WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_playlists_active" ON "playlists"("deletedAt")       WHERE "deletedAt" IS NULL;
