-- CreateTable
CREATE TABLE "auto_responder_rules" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'New Rule',
    "trigger" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'regex',
    "response" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedChannels" TEXT,
    "ignoredChannels" TEXT,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_responder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auto_responder_rules_guildId_idx" ON "auto_responder_rules"("guildId");

-- AddForeignKey
ALTER TABLE "auto_responder_rules" ADD CONSTRAINT "auto_responder_rules_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
