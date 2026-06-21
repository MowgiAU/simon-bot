-- Genre groups: user-saved collections of genres for quick feed access
CREATE TABLE "genre_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "genre_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "genre_group_genres" (
    "groupId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    CONSTRAINT "genre_group_genres_pkey" PRIMARY KEY ("groupId","genreId")
);

CREATE INDEX "genre_groups_userId_idx" ON "genre_groups"("userId");
CREATE INDEX "genre_group_genres_genreId_idx" ON "genre_group_genres"("genreId");

ALTER TABLE "genre_group_genres" ADD CONSTRAINT "genre_group_genres_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "genre_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "genre_group_genres" ADD CONSTRAINT "genre_group_genres_genreId_fkey"
    FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
