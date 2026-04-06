-- CreateTable
CREATE TABLE "reaction_roles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reaction_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reaction_roles_guildId_idx" ON "reaction_roles"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "reaction_roles_messageId_emoji_key" ON "reaction_roles"("messageId", "emoji");

-- AddForeignKey
ALTER TABLE "reaction_roles" ADD CONSTRAINT "reaction_roles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
