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
  // Restart if a process leaks past 1.5 GB — prevents OOM from silently
  // degrading performance before the OS killer fires.
  max_memory_restart: '1500M',
  node_args: '--max-old-space-size=1400',
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
    // Exits cleanly (code 0) when RADIO_WORKER_ENABLED is not set.
    // stop_exit_codes:[0] prevents PM2 from restarting on a clean exit so it
    // doesn't spin-loop when the worker is intentionally disabled.
    {
      ...defaults,
      name: 'radio-worker',
      script: 'src/bot/radio-worker.ts',
      autorestart: false,
      stop_exit_codes: [0],
      env: { NODE_ENV: 'production' },
    },
  ],
};
