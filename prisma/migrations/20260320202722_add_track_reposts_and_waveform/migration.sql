-- CreateTable
CREATE TABLE "track_reposts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_reposts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "track_reposts_userId_trackId_key" ON "track_reposts"("userId", "trackId");

-- CreateIndex
CREATE INDEX "track_reposts_trackId_idx" ON "track_reposts"("trackId");

-- CreateIndex
CREATE INDEX "track_reposts_userId_idx" ON "track_reposts"("userId");

-- AddForeignKey
ALTER TABLE "track_reposts" ADD CONSTRAINT "track_reposts_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "musician_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "musician_tracks" ADD COLUMN "waveformPeaks" JSONB;
