-- AlterTable: add auto-verify fields to welcome_gate_settings
ALTER TABLE "welcome_gate_settings" ADD COLUMN "autoVerifyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "welcome_gate_settings" ADD COLUMN "autoVerifyAfterHours" INTEGER NOT NULL DEFAULT 24;
