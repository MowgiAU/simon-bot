-- AlterTable
ALTER TABLE "musician_profiles" ADD COLUMN "primaryGenreId" TEXT;

-- AddForeignKey
ALTER TABLE "musician_profiles" ADD CONSTRAINT "musician_profiles_primaryGenreId_fkey" FOREIGN KEY ("primaryGenreId") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
