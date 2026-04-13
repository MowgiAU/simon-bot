-- AlterTable
ALTER TABLE "anti_external_forward_settings"
  ADD COLUMN "blockInternalForwards"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "blockedSourceChannelIds" TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "blockedTargetChannelIds" TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[];
