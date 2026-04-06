-- AlterTable: Add primary_genre_id to musician_profiles
ALTER TABLE "musician_profiles" ADD COLUMN "primary_genre_id" TEXT;

-- AddForeignKey
ALTER TABLE "musician_profiles" ADD CONSTRAINT "musician_profiles_primary_genre_id_fkey" FOREIGN KEY ("primary_genre_id") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
