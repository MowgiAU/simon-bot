-- AlterTable
ALTER TABLE "moderation_settings" ADD COLUMN "removeAlertRoleId" TEXT;

-- AlterTable
ALTER TABLE "moderation_permissions" ADD COLUMN "canRemove" BOOLEAN NOT NULL DEFAULT false;
