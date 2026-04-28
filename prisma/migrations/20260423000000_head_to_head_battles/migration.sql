-- Head-to-Head 1v1 Producer Battles

-- HeadToHeadSettings
CREATE TABLE "head_to_head_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "announcementChannelId" TEXT,
    "defaultProductionMinutes" INTEGER NOT NULL DEFAULT 60,
    "defaultVotingMinutes" INTEGER NOT NULL DEFAULT 30,
    "readyUpMinutes" INTEGER NOT NULL DEFAULT 5,
    "startingElo" INTEGER NOT NULL DEFAULT 1200,
    "kFactor" INTEGER NOT NULL DEFAULT 32,
    "minVotesToFinalize" INTEGER NOT NULL DEFAULT 3,
    "maxQueueWaitMinutes" INTEGER NOT NULL DEFAULT 30,
    "samplesPerMatch" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "head_to_head_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "head_to_head_settings_guildId_key" ON "head_to_head_settings"("guildId");
ALTER TABLE "head_to_head_settings" ADD CONSTRAINT "head_to_head_settings_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- H2HSamplePool
CREATE TABLE "h2h_sample_pools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "genreId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "h2h_sample_pools_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "h2h_sample_pools_genreId_idx" ON "h2h_sample_pools"("genreId");
ALTER TABLE "h2h_sample_pools" ADD CONSTRAINT "h2h_sample_pools_genreId_fkey"
    FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- H2HSample
CREATE TABLE "h2h_samples" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "h2h_samples_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "h2h_samples_poolId_idx" ON "h2h_samples"("poolId");
ALTER TABLE "h2h_samples" ADD CONSTRAINT "h2h_samples_poolId_fkey"
    FOREIGN KEY ("poolId") REFERENCES "h2h_sample_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- H2HMatch
CREATE TABLE "h2h_matches" (
    "id" TEXT NOT NULL,
    "guildId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "genreId" TEXT,
    "productionMinutes" INTEGER NOT NULL DEFAULT 60,
    "votingMinutes" INTEGER NOT NULL DEFAULT 30,
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT,
    "sampleIds" JSONB,
    "readyDeadline" TIMESTAMP(3),
    "challengerReady" BOOLEAN NOT NULL DEFAULT false,
    "opponentReady" BOOLEAN NOT NULL DEFAULT false,
    "readyUpStartedAt" TIMESTAMP(3),
    "producingStartedAt" TIMESTAMP(3),
    "producingDeadline" TIMESTAMP(3),
    "challengerSubmissionUrl" TEXT,
    "challengerSubmissionAt" TIMESTAMP(3),
    "opponentSubmissionUrl" TEXT,
    "opponentSubmissionAt" TIMESTAMP(3),
    "votingStart" TIMESTAMP(3),
    "votingEnd" TIMESTAMP(3),
    "winnerId" TEXT,
    "loserId" TEXT,
    "forfeitReason" TEXT,
    "challengerEloBefore" INTEGER,
    "challengerEloAfter" INTEGER,
    "opponentEloBefore" INTEGER,
    "opponentEloAfter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "h2h_matches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "h2h_matches_status_idx" ON "h2h_matches"("status");
CREATE INDEX "h2h_matches_genreId_idx" ON "h2h_matches"("genreId");
CREATE INDEX "h2h_matches_challengerId_idx" ON "h2h_matches"("challengerId");
CREATE INDEX "h2h_matches_opponentId_idx" ON "h2h_matches"("opponentId");
ALTER TABLE "h2h_matches" ADD CONSTRAINT "h2h_matches_genreId_fkey"
    FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- H2HVote
CREATE TABLE "h2h_votes" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "voteFor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "h2h_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "h2h_votes_matchId_voterId_key" ON "h2h_votes"("matchId", "voterId");
CREATE INDEX "h2h_votes_matchId_idx" ON "h2h_votes"("matchId");
ALTER TABLE "h2h_votes" ADD CONSTRAINT "h2h_votes_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "h2h_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- H2HRating
CREATE TABLE "h2h_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "genreId" TEXT,
    "elo" INTEGER NOT NULL DEFAULT 1200,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "forfeits" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "h2h_ratings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "h2h_ratings_userId_genreId_key" ON "h2h_ratings"("userId", "genreId");
CREATE INDEX "h2h_ratings_genreId_idx" ON "h2h_ratings"("genreId");
CREATE INDEX "h2h_ratings_elo_idx" ON "h2h_ratings"("elo");
ALTER TABLE "h2h_ratings" ADD CONSTRAINT "h2h_ratings_genreId_fkey"
    FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
