// PM2 Ecosystem Configuration
// Uses tsx as interpreter to run TypeScript directly, avoiding ESM module resolution issues
// with the compiled dist/ output.
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'src/api/index.ts',
      interpreter: './node_modules/.bin/tsx',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'bot',
      script: 'src/bot/start.ts',
      interpreter: './node_modules/.bin/tsx',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
