-- CreateTable
CREATE TABLE "radio_commands" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radio_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "radio_commands_guildId_status_idx" ON "radio_commands"("guildId", "status");
