-- ─────────────────────────────────────────────────────────────────────────────
-- Ranked voting + Sudden Death tie-breaker
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. BattleVote: add battleId + rank
ALTER TABLE "battle_votes" ADD COLUMN "battleId" TEXT;
ALTER TABLE "battle_votes" ADD COLUMN "rank" INTEGER NOT NULL DEFAULT 1;

-- 2. Backfill battleId from the entry
UPDATE "battle_votes" v
SET "battleId" = e."battleId"
FROM "battle_entries" e
WHERE v."entryId" = e."id";

-- 3. Collapse legacy votes: keep only the first 3 (by createdAt) per (battleId,userId),
--    assigning ranks 1,2,3. Drop the rest so the new unique (battleId,userId,rank)
--    constraint is satisfiable.
WITH ranked AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "battleId", "userId"
            ORDER BY "createdAt" ASC
        ) AS rn
    FROM "battle_votes"
)
UPDATE "battle_votes" v
SET "rank" = ranked.rn
FROM ranked
WHERE v."id" = ranked."id" AND ranked.rn <= 3;

DELETE FROM "battle_votes" v
USING (
    SELECT "id"
    FROM (
        SELECT
            "id",
            ROW_NUMBER() OVER (
                PARTITION BY "battleId", "userId"
                ORDER BY "createdAt" ASC
            ) AS rn
        FROM "battle_votes"
    ) sub
    WHERE sub.rn > 3
) over3
WHERE v."id" = over3."id";

-- 4. Enforce NOT NULL on battleId now that backfill is complete
ALTER TABLE "battle_votes" ALTER COLUMN "battleId" SET NOT NULL;

-- 5. Add new unique constraint and index
CREATE UNIQUE INDEX "battle_votes_battleId_userId_rank_key"
    ON "battle_votes"("battleId", "userId", "rank");
CREATE INDEX "battle_votes_battleId_idx" ON "battle_votes"("battleId");

-- 6. BeatBattle: per-battle sudden death fields
ALTER TABLE "beat_battles" ADD COLUMN "suddenDeathDurationMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "beat_battles" ADD COLUMN "suddenDeathStart" TIMESTAMP(3);
ALTER TABLE "beat_battles" ADD COLUMN "suddenDeathEnd" TIMESTAMP(3);
ALTER TABLE "beat_battles" ADD COLUMN "suddenDeathEntryIds" JSONB;

-- 7. BeatBattleSettings: default sudden death duration (per guild)
ALTER TABLE "beat_battle_settings" ADD COLUMN "suddenDeathDurationMinutes" INTEGER NOT NULL DEFAULT 60;
