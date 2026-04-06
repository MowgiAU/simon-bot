-- CreateTable
CREATE TABLE "server_boost_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "announcementChannelId" TEXT,
    "messageText" TEXT,
    "embedJson" TEXT,
    "reactionEmoji" TEXT,
    "rewardRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_boost_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "server_boost_settings_guildId_key" ON "server_boost_settings"("guildId");

-- AddForeignKey
ALTER TABLE "server_boost_settings" ADD CONSTRAINT "server_boost_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
