-- AlterTable: Add showOnPage to BattleSponsor
ALTER TABLE "battle_sponsors" ADD COLUMN "showOnPage" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Add featuredBattleId and sponsorSectionTitle to BeatBattleSettings
ALTER TABLE "beat_battle_settings" ADD COLUMN "featuredBattleId" TEXT;
ALTER TABLE "beat_battle_settings" ADD COLUMN "sponsorSectionTitle" TEXT;
