// PM2 Ecosystem Configuration
// Uses tsx as interpreter to run TypeScript directly, avoiding ESM module resolution issues
// with the compiled dist/ output.

// Shared defaults for all processes
const defaults = {
  interpreter: './node_modules/.bin/tsx',
  autorestart: true,
  min_uptime: '10s',
  exp_backoff_restart_delay: 100,
  max_restarts: 10,
};

// Factory for voice worker entries — each gets its own WORKER_ID so it knows
// which VOICE_BOT_{N}_TOKEN / VOICE_BOT_{N}_CLIENT_ID env vars to read.
const voiceWorker = (n) => ({
  ...defaults,
  name: `voice-worker-${n}`,
  script: 'src/bot/voice-worker.ts',
  env: {
    NODE_ENV: 'production',
    WORKER_ID: `voice-worker-${n}`,
    // VOICE_BOT_{N}_TOKEN and VOICE_BOT_{N}_CLIENT_ID must be set in the server .env
  },
});

module.exports = {
  apps: [
    // ── Core processes ──────────────────────────────────────────────────────
    {
      ...defaults,
      name: 'api',
      script: 'src/api/index.ts',
      env: { NODE_ENV: 'production' },
    },
    {
      ...defaults,
      name: 'bot',
      script: 'src/bot/start.ts',
      env: {
        NODE_ENV: 'production',
        // Set VOICE_WORKERS_ENABLED=true in server .env to disable voice joining
        // in the main bot and hand off to the voice workers below.
      },
    },

    // ── Voice recording workers (one per Discord bot token) ─────────────────
    // Workers exit cleanly if their VOICE_BOT_{N}_TOKEN is not set in .env,
    // so it is safe to deploy before all tokens are configured.
    voiceWorker(1),
    voiceWorker(2),
    voiceWorker(3),
    voiceWorker(4),
    voiceWorker(5),

    // ── Radio worker ────────────────────────────────────────────────────────
    // Exits cleanly if RADIO_BOT_TOKEN is not set.
    // Full radio playback implementation is pending; the main bot's
    // FujiRadioPlugin continues to handle radio in the interim.
    {
      ...defaults,
      name: 'radio-worker',
      script: 'src/bot/radio-worker.ts',
      env: { NODE_ENV: 'production' },
    },
  ],
};
