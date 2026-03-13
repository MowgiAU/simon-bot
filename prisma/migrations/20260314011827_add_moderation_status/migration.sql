-- AlterTable: Add status and statusReason to musician_profiles
ALTER TABLE "musician_profiles" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "musician_profiles" ADD COLUMN "statusReason" TEXT;

-- AlterTable: Add status and statusReason to musician_tracks
ALTER TABLE "musician_tracks" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "musician_tracks" ADD COLUMN "statusReason" TEXT;
