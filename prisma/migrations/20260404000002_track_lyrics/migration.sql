-- AddColumn: lyrics (plain text) and lyricsSync (time-cued JSON) to musician_tracks
ALTER TABLE "musician_tracks" ADD COLUMN IF NOT EXISTS "lyrics" TEXT;
ALTER TABLE "musician_tracks" ADD COLUMN IF NOT EXISTS "lyricsSync" JSONB;
