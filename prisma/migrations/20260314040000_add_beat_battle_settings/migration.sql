-- CreateTable
CREATE TABLE "beat_battle_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "battleCategoryId" TEXT,
    "announcementChannelId" TEXT,
    "chatChannelId" TEXT,
    "submissionCategoryId" TEXT,
    "archiveCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beat_battle_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beat_battle_settings_guildId_key" ON "beat_battle_settings"("guildId");

-- AddForeignKey
ALTER TABLE "beat_battle_settings" ADD CONSTRAINT "beat_battle_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
