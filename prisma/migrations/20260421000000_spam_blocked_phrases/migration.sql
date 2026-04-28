-- SpamGuard: Blocked phrases / full-message blocklist
-- Allows mods to add phrases (or whole messages) that should be auto-deleted
-- when posted, just like the perceptual image hash blocklist.

CREATE TABLE "spam_blocked_phrases" (
    "id"            TEXT NOT NULL,
    "guildId"       TEXT NOT NULL,
    "phrase"        TEXT NOT NULL,
    "description"   TEXT,
    "addedByMod"    TEXT,
    "isRegex"       BOOLEAN NOT NULL DEFAULT false,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "hitCount"      INTEGER NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spam_blocked_phrases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "spam_blocked_phrases_guildId_phrase_key" ON "spam_blocked_phrases"("guildId", "phrase");
CREATE INDEX "spam_blocked_phrases_guildId_idx" ON "spam_blocked_phrases"("guildId");

ALTER TABLE "spam_blocked_phrases"
    ADD CONSTRAINT "spam_blocked_phrases_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "spam_guard_settings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
