-- Genre post features: flairs, cross-posts, pinning, admin hide
ALTER TABLE "genre_posts" ADD COLUMN "flair" TEXT;
ALTER TABLE "genre_posts" ADD COLUMN "crossPostOfId" TEXT;
ALTER TABLE "genre_posts" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "genre_posts" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "genre_posts" ADD COLUMN "hiddenAt" TIMESTAMP(3);
ALTER TABLE "genre_posts" ADD COLUMN "hideReason" TEXT;

ALTER TABLE "genre_posts" ADD CONSTRAINT "genre_posts_crossPostOfId_fkey"
    FOREIGN KEY ("crossPostOfId") REFERENCES "genre_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "genre_posts_crossPostOfId_idx" ON "genre_posts"("crossPostOfId");
CREATE INDEX "genre_posts_pinned_idx" ON "genre_posts"("pinned");

-- Comment admin hide
ALTER TABLE "comments" ADD COLUMN "hiddenAt" TIMESTAMP(3);
ALTER TABLE "comments" ADD COLUMN "hideReason" TEXT;
