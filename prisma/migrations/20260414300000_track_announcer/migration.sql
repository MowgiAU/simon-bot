-- CreateTable: TrackAnnouncerSettings (per-guild config)
CREATE TABLE "track_announcer_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "track_announcer_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TrackAnnouncement (queue written by API, consumed by bot)
CREATE TABLE "track_announcements" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "trackTitle" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "profileUsername" TEXT NOT NULL,
    "trackSlug" TEXT,
    "coverUrl" TEXT,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "track_announcer_settings_guildId_key" ON "track_announcer_settings"("guildId");

-- CreateIndex
CREATE INDEX "track_announcements_postedAt_idx" ON "track_announcements"("postedAt");

-- CreateIndex
CREATE INDEX "track_announcements_createdAt_idx" ON "track_announcements"("createdAt");

-- AddForeignKey
ALTER TABLE "track_announcer_settings" ADD CONSTRAINT "track_announcer_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
