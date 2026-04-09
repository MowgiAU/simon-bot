-- CreateTable: auto_responder_categories
-- Rules can be grouped into categories that share channel filters and cooldown settings.

CREATE TABLE "auto_responder_categories" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'New Category',
    "allowedChannels" TEXT,
    "ignoredChannels" TEXT,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "cooldownReactionEmoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auto_responder_categories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auto_responder_categories_guildId_idx" ON "auto_responder_categories"("guildId");

ALTER TABLE "auto_responder_categories" ADD CONSTRAINT "auto_responder_categories_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add categoryId column to auto_responder_rules
ALTER TABLE "auto_responder_rules" ADD COLUMN "categoryId" TEXT;

ALTER TABLE "auto_responder_rules" ADD CONSTRAINT "auto_responder_rules_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "auto_responder_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
