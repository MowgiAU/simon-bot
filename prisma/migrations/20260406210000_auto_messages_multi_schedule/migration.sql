-- Drop old single-config tables (no data worth preserving)
DROP TABLE IF EXISTS "auto_message_entries";
DROP TABLE IF EXISTS "auto_message_configs";

-- CreateTable: auto_message_schedules (many per guild)
CREATE TABLE "auto_message_schedules" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'New Schedule',
    "channelId" TEXT,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_message_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: auto_message_entries (tied to scheduleId)
CREATE TABLE "auto_message_entries" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_message_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auto_message_schedules_guildId_idx" ON "auto_message_schedules"("guildId");

-- CreateIndex
CREATE INDEX "auto_message_entries_scheduleId_idx" ON "auto_message_entries"("scheduleId");

-- AddForeignKey
ALTER TABLE "auto_message_schedules" ADD CONSTRAINT "auto_message_schedules_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_message_entries" ADD CONSTRAINT "auto_message_entries_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "auto_message_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
