-- Stems: user-uploaded, individually-rendered audio tracks attached to a Track,
-- played back in a synced multi-track mixer (mute/solo/volume per stem).

-- CreateTable: track_stems
CREATE TABLE "track_stems" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mp3Url" TEXT,
    "peaks" JSONB,
    "duration" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_stems_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "track_stems_trackId_order_idx" ON "track_stems"("trackId", "order");

-- AddForeignKey
ALTER TABLE "track_stems" ADD CONSTRAINT "track_stems_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "musician_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
