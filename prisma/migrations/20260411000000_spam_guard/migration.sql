-- SpamGuard plugin tables
-- Layer 1: Behavioral tripwire (attachment flood + channel spread)
-- Layer 2: Perceptual image hash blocklist

CREATE TABLE "spam_guard_settings" (
    "id"                     TEXT NOT NULL,
    "guildId"                TEXT NOT NULL,
    "enabled"                BOOLEAN NOT NULL DEFAULT true,
    "attachmentLimit"        INTEGER NOT NULL DEFAULT 3,
    "attachmentWindowSec"    INTEGER NOT NULL DEFAULT 15,
    "channelSpreadLimit"     INTEGER NOT NULL DEFAULT 3,
    "channelSpreadWindowSec" INTEGER NOT NULL DEFAULT 30,
    "action"                 TEXT NOT NULL DEFAULT 'timeout',
    "timeoutMinutes"         INTEGER NOT NULL DEFAULT 10,
    "alertChannelId"         TEXT,
    "exemptRoles"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spam_guard_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "spam_guard_settings_guildId_key" ON "spam_guard_settings"("guildId");

ALTER TABLE "spam_guard_settings"
    ADD CONSTRAINT "spam_guard_settings_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------

CREATE TABLE "spam_image_hashes" (
    "id"          TEXT NOT NULL,
    "guildId"     TEXT NOT NULL,
    "hash"        TEXT NOT NULL,
    "description" TEXT,
    "addedByMod"  TEXT,
    "hitCount"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spam_image_hashes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "spam_image_hashes_guildId_hash_key" ON "spam_image_hashes"("guildId", "hash");
CREATE INDEX "spam_image_hashes_guildId_idx" ON "spam_image_hashes"("guildId");

ALTER TABLE "spam_image_hashes"
    ADD CONSTRAINT "spam_image_hashes_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "spam_guard_settings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------

CREATE TABLE "spam_guard_incidents" (
    "id"          TEXT NOT NULL,
    "guildId"     TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "username"    TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "channelId"   TEXT,
    "messageIds"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "details"     TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spam_guard_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "spam_guard_incidents_guildId_createdAt_idx" ON "spam_guard_incidents"("guildId", "createdAt");
CREATE INDEX "spam_guard_incidents_userId_idx" ON "spam_guard_incidents"("userId");

ALTER TABLE "spam_guard_incidents"
    ADD CONSTRAINT "spam_guard_incidents_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
