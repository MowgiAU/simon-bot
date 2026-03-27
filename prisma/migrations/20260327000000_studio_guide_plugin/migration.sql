-- CreateTable
CREATE TABLE "studio_guide_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channelId" TEXT,
    "pauseRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 30,
    "systemPrompt" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_guide_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_guide_conversations" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "topic" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_guide_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "studio_guide_settings_guildId_key" ON "studio_guide_settings"("guildId");

-- CreateIndex
CREATE INDEX "studio_guide_conversations_guildId_channelId_userId_active_idx" ON "studio_guide_conversations"("guildId", "channelId", "userId", "active");

-- AddForeignKey
ALTER TABLE "studio_guide_settings" ADD CONSTRAINT "studio_guide_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_guide_conversations" ADD CONSTRAINT "studio_guide_conversations_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "studio_guide_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
