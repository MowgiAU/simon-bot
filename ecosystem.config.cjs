// PM2 Ecosystem Configuration
// Uses tsx as interpreter to run TypeScript directly, avoiding ESM module resolution issues
// with the compiled dist/ output.
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'src/api/index.ts',
      interpreter: './node_modules/.bin/tsx',
      // Auto-restart on crash
      autorestart: true,
      // Only count a restart as a crash if the process lived less than 10s
      // (prevents startup errors from burning through restart attempts)
      min_uptime: '10s',
      // Exponential backoff between restarts (100ms → 200ms → 400ms → ... capped at 30s)
      exp_backoff_restart_delay: 100,
      // Give up after 10 rapid crashes — prevents infinite crash loops
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'bot',
      script: 'src/bot/start.ts',
      interpreter: './node_modules/.bin/tsx',
      // Auto-restart on crash
      autorestart: true,
      min_uptime: '10s',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
