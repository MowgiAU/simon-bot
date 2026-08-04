-- Shorts feed ranking for tracks.
-- Epoch-anchored score (freshness + logarithmic engagement bump), so it never
-- needs a periodic decay pass — see computeFeedScore in src/api/index.ts.
ALTER TABLE "musician_tracks" ADD COLUMN "feedScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX "musician_tracks_isPublic_status_feedScore_idx"
    ON "musician_tracks" ("isPublic", "status", "feedScore" DESC);

-- Seed existing tracks with the recency + play-count part of the score (the two
-- components that live on this table), mirroring HOT_EPOCH / HOT_TIME_DIVISOR /
-- playBoost in the API. Likes, reposts and comments fold in the first time each
-- track is engaged with, or via POST /api/admin/tracks/feed-score/backfill.
UPDATE "musician_tracks"
SET "feedScore" =
    (EXTRACT(EPOCH FROM "createdAt")::double precision - 1134028003) / 33000
    + CASE WHEN "playCount" > 0
           THEN LOG(10, ("playCount" + 1)::numeric)::double precision * 3
           ELSE 0 END;
