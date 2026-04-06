-- AlterTable
ALTER TABLE "feedback_settings" ADD COLUMN "approverRoleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
