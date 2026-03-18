-- Add parentId for threaded comment replies (one level deep)
ALTER TABLE "comments" ADD COLUMN "parentId" TEXT;
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");
