-- CreateTable: profile_styles
-- Stores per-user cosmetic style grants for the public profile page.
CREATE TABLE "profile_styles" (
    "id"            TEXT NOT NULL,
    "guildId"       TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "gradient"      TEXT,
    "animation"     TEXT NOT NULL DEFAULT 'none',
    "glowColor"     TEXT,
    "glowIntensity" INTEGER NOT NULL DEFAULT 6,
    "badgeLabel"    TEXT,
    "badgeColor"    TEXT,
    "note"          TEXT,
    "grantedBy"     TEXT,
    "grantedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_styles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_styles_guildId_userId_key" ON "profile_styles"("guildId", "userId");
CREATE INDEX "profile_styles_userId_idx" ON "profile_styles"("userId");
