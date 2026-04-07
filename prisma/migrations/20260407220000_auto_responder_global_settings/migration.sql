-- Move globalCooldownSeconds from per-rule to a guild-level settings table

CREATE TABLE "auto_responder_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "globalCooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "auto_responder_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auto_responder_settings_guildId_key" ON "auto_responder_settings"("guildId");

ALTER TABLE "auto_responder_settings" ADD CONSTRAINT "auto_responder_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auto_responder_rules" DROP COLUMN IF EXISTS "globalCooldownSeconds";
