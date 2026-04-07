-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "coverImageUrl" TEXT,
    "authorUserId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatar" TEXT,
    "category" TEXT NOT NULL DEFAULT 'news',
    "tags" JSONB DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredAt" TIMESTAMP(3),
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");
CREATE INDEX "articles_status_publishedAt_idx" ON "articles"("status", "publishedAt");
CREATE INDEX "articles_authorUserId_idx" ON "articles"("authorUserId");
CREATE INDEX "articles_category_idx" ON "articles"("category");
CREATE INDEX "articles_isFeatured_idx" ON "articles"("isFeatured");
CREATE INDEX "articles_guildId_idx" ON "articles"("guildId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
