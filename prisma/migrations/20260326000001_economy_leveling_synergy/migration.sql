-- Economy x Leveling Synergy: new columns on leveling_settings + xp_boosters table

-- Add economy synergy columns to leveling_settings (idempotent)
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "economyRewardsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "levelUpCurrencyReward" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "milestoneLevels" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "microRewardsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "microRewardAmount" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "microRewardReactions" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "microRewardVoiceMin" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "activityScalingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "xpBoosterEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "xpBoosterPrice" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "xpBoosterMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5;
ALTER TABLE "leveling_settings" ADD COLUMN IF NOT EXISTS "xpBoosterDurationMin" INTEGER NOT NULL DEFAULT 60;

-- Create xp_boosters table
CREATE TABLE IF NOT EXISTS "xp_boosters" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "xp_boosters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "xp_boosters_guildId_userId_key" ON "xp_boosters"("guildId", "userId");
