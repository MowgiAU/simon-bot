-- AlterTable
ALTER TABLE "studio_guide_settings" ADD COLUMN "suppressionRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "studio_guide_settings" ADD COLUMN "suppressionMinutes" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "studio_guide_opt_outs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_guide_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "studio_guide_opt_outs_guildId_userId_key" ON "studio_guide_opt_outs"("guildId", "userId");

-- AddForeignKey
ALTER TABLE "studio_guide_opt_outs" ADD CONSTRAINT "studio_guide_opt_outs_guild_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_guide_opt_outs" ADD CONSTRAINT "studio_guide_opt_outs_settings_fkey" FOREIGN KEY ("guildId") REFERENCES "studio_guide_settings"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;
