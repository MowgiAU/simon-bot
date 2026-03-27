-- CreateTable
CREATE TABLE "studio_guide_knowledge" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_guide_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_guide_knowledge_guildId_enabled_idx" ON "studio_guide_knowledge"("guildId", "enabled");

-- AddForeignKey
ALTER TABLE "studio_guide_knowledge" ADD CONSTRAINT "studio_guide_knowledge_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
