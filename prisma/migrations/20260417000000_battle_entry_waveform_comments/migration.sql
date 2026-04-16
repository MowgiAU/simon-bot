-- AlterTable
ALTER TABLE "battle_entries" ADD COLUMN "waveformPeaks" JSONB;

-- AlterTable
ALTER TABLE "comments" ADD COLUMN "battleEntryId" TEXT;

-- CreateIndex
CREATE INDEX "comments_battleEntryId_idx" ON "comments"("battleEntryId");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_battleEntryId_fkey" FOREIGN KEY ("battleEntryId") REFERENCES "battle_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
