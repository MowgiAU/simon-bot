-- CreateTable
CREATE TABLE "radio_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "voiceChannelId" TEXT,
    "textChannelId" TEXT,
    "nowPlayingMessageId" TEXT,
    "autoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoSource" TEXT NOT NULL DEFAULT 'random',
    "autoGenreFilter" TEXT,
    "ttsAnnounce" BOOLEAN NOT NULL DEFAULT false,
    "adsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "adFrequency" INTEGER NOT NULL DEFAULT 5,
    "adTtsDefault" TEXT,
    "listenerXpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "listenerXpPerMinute" INTEGER NOT NULL DEFAULT 1,
    "tipEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minTipAmount" INTEGER NOT NULL DEFAULT 1,
    "defaultVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "duckVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radio_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radio_queue" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "addedBy" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isAd" BOOLEAN NOT NULL DEFAULT false,
    "adText" TEXT,
    "adAudioUrl" TEXT,
    "playedAt" TIMESTAMP(3),
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radio_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radio_history" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "trackId" TEXT,
    "trackTitle" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "coverUrl" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "listenCount" INTEGER NOT NULL DEFAULT 0,
    "isAd" BOOLEAN NOT NULL DEFAULT false,
    "hostedBy" TEXT,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radio_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radio_ad_slots" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adType" TEXT NOT NULL DEFAULT 'tts',
    "adText" TEXT,
    "audioUrl" TEXT,
    "costPaid" INTEGER NOT NULL DEFAULT 0,
    "playsLeft" INTEGER NOT NULL DEFAULT 3,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radio_ad_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "radio_settings_guildId_key" ON "radio_settings"("guildId");

-- CreateIndex
CREATE INDEX "radio_queue_guildId_position_idx" ON "radio_queue"("guildId", "position");

-- CreateIndex
CREATE INDEX "radio_history_guildId_playedAt_idx" ON "radio_history"("guildId", "playedAt");

-- CreateIndex
CREATE INDEX "radio_ad_slots_guildId_active_idx" ON "radio_ad_slots"("guildId", "active");

-- AddForeignKey
ALTER TABLE "radio_settings" ADD CONSTRAINT "radio_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radio_queue" ADD CONSTRAINT "radio_queue_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radio_history" ADD CONSTRAINT "radio_history_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
