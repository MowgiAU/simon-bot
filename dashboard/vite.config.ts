import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000, // or 3002 for prod
    allowedHosts: [
      'dashboard.fujistud.io',
      'staging.fujistud.io'
    ]
  }
});
