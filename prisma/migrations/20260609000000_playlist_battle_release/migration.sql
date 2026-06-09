-- AlterTable: link a Playlist back to the BeatBattle it was released from (1:1, optional)
ALTER TABLE "playlists" ADD COLUMN "battleId" TEXT;
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "beat_battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "playlists_battleId_key" ON "playlists"("battleId");
