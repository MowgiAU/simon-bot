-- AlterTable: add requireProjectFile to beat_battles
ALTER TABLE "beat_battles" ADD COLUMN "requireProjectFile" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add description and projectUrl to battle_entries
ALTER TABLE "battle_entries" ADD COLUMN "description" TEXT;
ALTER TABLE "battle_entries" ADD COLUMN "projectUrl" TEXT;
