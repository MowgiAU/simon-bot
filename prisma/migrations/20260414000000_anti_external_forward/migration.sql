-- CreateTable
CREATE TABLE "anti_external_forward_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "deleteMessage" BOOLEAN NOT NULL DEFAULT true,
    "warnUser" BOOLEAN NOT NULL DEFAULT true,
    "exemptRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exemptChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anti_external_forward_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anti_external_forward_settings_guildId_key" ON "anti_external_forward_settings"("guildId");

-- AddForeignKey
ALTER TABLE "anti_external_forward_settings" ADD CONSTRAINT "anti_external_forward_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
