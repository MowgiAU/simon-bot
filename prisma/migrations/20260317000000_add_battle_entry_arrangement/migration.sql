-- Add parsed FLP arrangement data to battle entries
ALTER TABLE "battle_entries" ADD COLUMN "arrangement" JSONB;
