-- CreateTable: voice_stat_settings
-- Auto-updating unjoinable voice channels that display live server stats.

CREATE TABLE "voice_stat_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,

    "memberChannelId"      TEXT,
    "memberChannelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "memberLabel"          TEXT NOT NULL DEFAULT '👥 Members: {count}',

    "boostChannelId"       TEXT,
    "boostChannelEnabled"  BOOLEAN NOT NULL DEFAULT false,
    "boostLabel"           TEXT NOT NULL DEFAULT '✨ Boosts: {count}',

    "artistChannelId"      TEXT,
    "artistChannelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "artistLabel"          TEXT NOT NULL DEFAULT '🎵 Artists: {count}',

    "trackChannelId"       TEXT,
    "trackChannelEnabled"  BOOLEAN NOT NULL DEFAULT false,
    "trackLabel"           TEXT NOT NULL DEFAULT '🎶 Tracks: {count}',

    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_stat_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_stat_settings_guildId_key" ON "voice_stat_settings"("guildId");

ALTER TABLE "voice_stat_settings"
    ADD CONSTRAINT "voice_stat_settings_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
