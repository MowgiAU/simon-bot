-- Add category to h2h_samples
ALTER TABLE "h2h_samples" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';
CREATE INDEX "h2h_samples_category_idx" ON "h2h_samples"("category");

-- Add per-match optional category toggles
ALTER TABLE "h2h_matches" ADD COLUMN "includeBass" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "h2h_matches" ADD COLUMN "includeMelody" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "h2h_matches" ADD COLUMN "includeChords" BOOLEAN NOT NULL DEFAULT true;
