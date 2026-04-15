-- AlterTable: add user-customisable accent and card-background colours to musician profiles
ALTER TABLE "musician_profiles" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
ALTER TABLE "musician_profiles" ADD COLUMN IF NOT EXISTS "cardBgColor" TEXT;
