-- Add slug column to beat_battles for human-readable URLs
ALTER TABLE "beat_battles" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "beat_battles_slug_key" ON "beat_battles"("slug");
