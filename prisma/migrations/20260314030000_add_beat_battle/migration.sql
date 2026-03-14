-- CreateTable
CREATE TABLE "beat_battles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "rules" TEXT,
    "submissionStart" TIMESTAMP(3),
    "submissionEnd" TIMESTAMP(3),
    "votingStart" TIMESTAMP(3),
    "votingEnd" TIMESTAMP(3),
    "announcementMsgId" TEXT,
    "submissionChannelId" TEXT,
    "announcementChannelId" TEXT,
    "categoryId" TEXT,
    "winnerEntryId" TEXT,
    "winnerSpotlightMsgId" TEXT,
    "sponsorId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beat_battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_entries" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "trackTitle" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "coverUrl" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "discordMsgId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_votes" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_sponsors" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_sponsor_links" (
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_sponsor_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_analytics" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "beat_battles_guildId_idx" ON "beat_battles"("guildId");
CREATE INDEX "beat_battles_status_idx" ON "beat_battles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "battle_entries_battleId_userId_key" ON "battle_entries"("battleId", "userId");
CREATE INDEX "battle_entries_battleId_idx" ON "battle_entries"("battleId");

-- CreateIndex
CREATE UNIQUE INDEX "battle_votes_entryId_userId_key" ON "battle_votes"("entryId", "userId");
CREATE INDEX "battle_votes_entryId_idx" ON "battle_votes"("entryId");

-- CreateIndex
CREATE INDEX "battle_sponsors_guildId_idx" ON "battle_sponsors"("guildId");

-- CreateIndex
CREATE INDEX "battle_sponsor_links_sponsorId_idx" ON "battle_sponsor_links"("sponsorId");

-- CreateIndex
CREATE INDEX "battle_analytics_battleId_idx" ON "battle_analytics"("battleId");
CREATE INDEX "battle_analytics_eventType_idx" ON "battle_analytics"("eventType");

-- AddForeignKey
ALTER TABLE "beat_battles" ADD CONSTRAINT "beat_battles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "beat_battles" ADD CONSTRAINT "beat_battles_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "battle_sponsors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_entries" ADD CONSTRAINT "battle_entries_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "beat_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_votes" ADD CONSTRAINT "battle_votes_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "battle_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_sponsors" ADD CONSTRAINT "battle_sponsors_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_sponsor_links" ADD CONSTRAINT "battle_sponsor_links_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "battle_sponsors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_analytics" ADD CONSTRAINT "battle_analytics_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "beat_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
