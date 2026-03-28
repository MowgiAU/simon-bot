-- AlterTable: Add invite-only gate fields to User
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invited" BOOLEAN NOT NULL DEFAULT false;
