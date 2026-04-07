ALTER TABLE "auto_responder_rules" ADD COLUMN "cooldownReactionEmoji" TEXT;
ALTER TABLE "auto_responder_rules" ADD COLUMN "globalCooldownSeconds" INTEGER NOT NULL DEFAULT 0;
