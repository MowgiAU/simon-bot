-- CreateTable
CREATE TABLE "booster_color_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "boosterRoleId" TEXT,
    "colorRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "booster_color_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booster_color_settings_guildId_key" ON "booster_color_settings"("guildId");

-- AddForeignKey
ALTER TABLE "booster_color_settings" ADD CONSTRAINT "booster_color_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
