-- DropTable: voice_worker_locks (depends on nothing)
DROP TABLE IF EXISTS "voice_worker_locks";

-- DropTable: voice_reports (depends on voice_sessions)
DROP TABLE IF EXISTS "voice_reports";

-- DropTable: voice_segments (depends on voice_sessions)
DROP TABLE IF EXISTS "voice_segments";

-- DropTable: voice_sessions (depends on guilds)
DROP TABLE IF EXISTS "voice_sessions";

-- DropTable: voice_monitor_settings (depends on guilds)
DROP TABLE IF EXISTS "voice_monitor_settings";
