-- AlterTable
ALTER TABLE "dashboard_access" ADD COLUMN "betaRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
