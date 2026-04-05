-- Economy integrations: nick opt-out, radio listener coins, beat battle economy

-- Add nickOptOut to economy_accounts
ALTER TABLE "economy_accounts" ADD COLUMN "nickOptOut" BOOLEAN NOT NULL DEFAULT false;

-- Add listener coin earning to radio_settings
ALTER TABLE "radio_settings" ADD COLUMN "listenerCoinEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "radio_settings" ADD COLUMN "listenerCoinsPerMinute" INTEGER NOT NULL DEFAULT 1;

-- Add economy fields to beat_battle_settings
ALTER TABLE "beat_battle_settings" ADD COLUMN "entryFeeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "beat_battle_settings" ADD COLUMN "entryFee" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "beat_battle_settings" ADD COLUMN "prizePoolEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "beat_battle_settings" ADD COLUMN "prizeFirst" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "beat_battle_settings" ADD COLUMN "prizeSecond" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "beat_battle_settings" ADD COLUMN "prizeThird" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "beat_battle_settings" ADD COLUMN "voterReward" INTEGER NOT NULL DEFAULT 0;
