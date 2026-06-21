-- CreateTable
CREATE TABLE "genre_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "genre_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genre_posts" (
    "id" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "type" TEXT NOT NULL DEFAULT 'discussion',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "trackId" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "genre_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genre_post_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "genre_post_votes_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add genrePostId to comments
ALTER TABLE "comments" ADD COLUMN "genrePostId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "genre_subscriptions_userId_genreId_key" ON "genre_subscriptions"("userId", "genreId");
CREATE INDEX "genre_subscriptions_userId_idx" ON "genre_subscriptions"("userId");
CREATE INDEX "genre_subscriptions_genreId_idx" ON "genre_subscriptions"("genreId");

CREATE INDEX "genre_posts_genreId_hotScore_idx" ON "genre_posts"("genreId", "hotScore" DESC);
CREATE INDEX "genre_posts_genreId_createdAt_idx" ON "genre_posts"("genreId", "createdAt" DESC);
CREATE INDEX "genre_posts_genreId_score_idx" ON "genre_posts"("genreId", "score" DESC);
CREATE INDEX "genre_posts_userId_idx" ON "genre_posts"("userId");
CREATE INDEX "genre_posts_trackId_idx" ON "genre_posts"("trackId");

CREATE UNIQUE INDEX "genre_post_votes_userId_postId_key" ON "genre_post_votes"("userId", "postId");
CREATE INDEX "genre_post_votes_postId_idx" ON "genre_post_votes"("postId");

CREATE INDEX "comments_genrePostId_idx" ON "comments"("genrePostId");

-- AddForeignKey
ALTER TABLE "genre_subscriptions" ADD CONSTRAINT "genre_subscriptions_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genre_posts" ADD CONSTRAINT "genre_posts_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genre_posts" ADD CONSTRAINT "genre_posts_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "musician_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genre_post_votes" ADD CONSTRAINT "genre_post_votes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "genre_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_genrePostId_fkey" FOREIGN KEY ("genrePostId") REFERENCES "genre_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
