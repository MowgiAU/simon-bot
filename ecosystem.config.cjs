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
        FFMPEG_PATH: '/usr/bin/ffmpeg',
      },
    },

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
