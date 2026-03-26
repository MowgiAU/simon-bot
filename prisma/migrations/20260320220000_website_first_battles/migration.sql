-- Website-first Beat Battle rework: remove Discord-specific fields, add trackId to entries

-- BeatBattle: drop Discord-only columns
ALTER TABLE "beat_battles" DROP COLUMN IF EXISTS "announcementMsgId";
ALTER TABLE "beat_battles" DROP COLUMN IF EXISTS "submissionChannelId";
ALTER TABLE "beat_battles" DROP COLUMN IF EXISTS "categoryId";
ALTER TABLE "beat_battles" DROP COLUMN IF EXISTS "winnerSpotlightMsgId";

-- BattleEntry: drop discordMsgId, add trackId FK
ALTER TABLE "battle_entries" DROP COLUMN IF EXISTS "discordMsgId";
ALTER TABLE "battle_entries" ADD COLUMN IF NOT EXISTS "trackId" TEXT;
ALTER TABLE "battle_entries" ADD CONSTRAINT "battle_entries_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "musician_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BeatBattleSettings: drop category columns, add requireMusicianProfile
ALTER TABLE "beat_battle_settings" DROP COLUMN IF EXISTS "battleCategoryId";
ALTER TABLE "beat_battle_settings" DROP COLUMN IF EXISTS "submissionCategoryId";
ALTER TABLE "beat_battle_settings" DROP COLUMN IF EXISTS "archiveCategoryId";
ALTER TABLE "beat_battle_settings" ADD COLUMN IF NOT EXISTS "requireMusicianProfile" BOOLEAN NOT NULL DEFAULT false;
