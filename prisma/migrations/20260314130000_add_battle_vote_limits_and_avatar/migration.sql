-- AlterTable
ALTER TABLE "beat_battles" ADD COLUMN "maxVotesPerUser" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "battle_entries" ADD COLUMN "avatarUrl" TEXT;
