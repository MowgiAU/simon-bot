-- Add embed and mentionUser support to auto_responder_rules
ALTER TABLE "auto_responder_rules" ADD COLUMN "embedJson" TEXT;
ALTER TABLE "auto_responder_rules" ADD COLUMN "mentionUser" BOOLEAN NOT NULL DEFAULT false;
