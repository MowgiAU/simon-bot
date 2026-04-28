-- Battle entries become a slim join row keyed to a Track.
-- Step 1: backfill any orphan BattleEntry (no trackId) by creating a Track + Profile if needed.
-- Step 2: enforce trackId NOT NULL.
-- Step 3: relax legacy content columns to nullable so future code can stop writing them
--         (we keep them around for now; a follow-up migration will drop them).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    r RECORD;
    new_track_id TEXT;
    target_profile_id TEXT;
    fallback_username TEXT;
BEGIN
    FOR r IN
        SELECT *
        FROM battle_entries
        WHERE "trackId" IS NULL
    LOOP
        fallback_username := COALESCE(NULLIF(r."username", ''), 'producer');

        -- Find or create a MusicianProfile for this user
        SELECT id INTO target_profile_id
        FROM musician_profiles
        WHERE "userId" = r."userId"
        LIMIT 1;

        IF target_profile_id IS NULL THEN
            target_profile_id := 'be_' || replace(gen_random_uuid()::text, '-', '');
            INSERT INTO musician_profiles (id, "userId", username, "displayName", "createdAt", "updatedAt")
            VALUES (
                target_profile_id,
                r."userId",
                fallback_username,
                fallback_username,
                NOW(),
                NOW()
            );
        END IF;

        -- Create a Track from this entry
        new_track_id := 'be_' || replace(gen_random_uuid()::text, '-', '');
        INSERT INTO musician_tracks (
            id, "profileId", title, url, "coverUrl", description, duration,
            bpm, "key", artist, arrangement, "waveformPeaks",
            "isPublic", status, license, "playCount",
            "allowAudioDownload", "allowProjectDownload",
            "createdAt", "updatedAt"
        ) VALUES (
            new_track_id,
            target_profile_id,
            COALESCE(r."trackTitle", 'Untitled Battle Entry'),
            r."audioUrl",
            r."coverUrl",
            r."description",
            COALESCE(r."duration", 0),
            r."bpm",
            r."key",
            r."artist",
            r.arrangement,
            r."waveformPeaks",
            true,
            'active',
            'all-rights-reserved',
            0,
            true,
            true,
            r."createdAt",
            NOW()
        );

        UPDATE battle_entries
           SET "trackId" = new_track_id
         WHERE id = r.id;
    END LOOP;
END $$;

-- Drop legacy nullable constraints on content fields (already nullable for most;
-- ensures the new schema's optional columns line up).
ALTER TABLE "battle_entries"
    ALTER COLUMN "username"   DROP NOT NULL,
    ALTER COLUMN "trackTitle" DROP NOT NULL,
    ALTER COLUMN "audioUrl"   DROP NOT NULL,
    ALTER COLUMN "duration"   DROP NOT NULL;

-- Drop the old optional FK constraint and re-add it as required + cascade
ALTER TABLE "battle_entries" DROP CONSTRAINT IF EXISTS "battle_entries_trackId_fkey";
ALTER TABLE "battle_entries" ALTER COLUMN "trackId" SET NOT NULL;
ALTER TABLE "battle_entries"
    ADD CONSTRAINT "battle_entries_trackId_fkey"
    FOREIGN KEY ("trackId") REFERENCES "musician_tracks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- New index for the join
CREATE INDEX IF NOT EXISTS "battle_entries_trackId_idx" ON "battle_entries"("trackId");
