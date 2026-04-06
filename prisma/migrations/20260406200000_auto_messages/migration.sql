-- CreateTable: auto_message_configs
CREATE TABLE "auto_message_configs" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT,
    "interval_minutes" INTEGER NOT NULL DEFAULT 60,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "current_index" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_message_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: auto_message_entries
CREATE TABLE "auto_message_entries" (
    "id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_message_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auto_message_configs_guild_id_key" ON "auto_message_configs"("guild_id");

-- CreateIndex
CREATE INDEX "auto_message_entries_config_id_idx" ON "auto_message_entries"("config_id");

-- AddForeignKey
ALTER TABLE "auto_message_configs" ADD CONSTRAINT "auto_message_configs_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_message_entries" ADD CONSTRAINT "auto_message_entries_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "auto_message_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
