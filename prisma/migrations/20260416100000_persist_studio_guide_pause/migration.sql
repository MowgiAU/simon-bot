-- AlterTable
ALTER TABLE "studio_guide_settings" ADD COLUMN "pausedBy" TEXT;
ALTER TABLE "studio_guide_settings" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "studio_guide_settings" ADD COLUMN "pauseResumeAt" TIMESTAMP(3);
