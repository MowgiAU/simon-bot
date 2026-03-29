-- Add workerId to voice_sessions (nullable, for tracking which worker bot recorded)
ALTER TABLE "voice_sessions" ADD COLUMN "workerId" TEXT;

-- Create voice_worker_locks: atomic per-channel claim table
-- Composite PK (guildId, channelId) ensures only one worker can own a channel at a time
CREATE TABLE "voice_worker_locks" (
    "guildId"   TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "workerId"  TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voice_worker_locks_pkey" PRIMARY KEY ("guildId","channelId")
);
