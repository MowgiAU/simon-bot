-- AlterTable: add pendingAnnouncement flag to beat_battles
ALTER TABLE "beat_battles" ADD COLUMN "pendingAnnouncement" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add discordInviteUrl to beat_battle_settings
ALTER TABLE "beat_battle_settings" ADD COLUMN "discordInviteUrl" TEXT;
