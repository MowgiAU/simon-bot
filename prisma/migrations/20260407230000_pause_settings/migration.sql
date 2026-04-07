CREATE TABLE "pause_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "allowedRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "pause_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pause_settings_guildId_key" ON "pause_settings"("guildId");

ALTER TABLE "pause_settings" ADD CONSTRAINT "pause_settings_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
