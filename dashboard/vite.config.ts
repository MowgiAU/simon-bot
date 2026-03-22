import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Split heavy vendor libs into separately cached chunks.
        // These rarely change so browsers cache them across deploys.
        manualChunks(id) {
          // MUI (admin-only) → its own chunk; users on public pages never load it
          if (id.includes('@mui/') || id.includes('@emotion/')) return 'vendor-mui';
          // Charting library
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          // Animation libraries
          if (id.includes('framer-motion') || id.includes('/motion/')) return 'vendor-motion';
          // Remaining large node_modules get their own vendor chunk
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
    // Warn when any individual chunk exceeds 500KB uncompressed
    chunkSizeWarningLimit: 500,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: [
      'dashboard.fujistud.io',
      'staging.fujistud.io'
    ]
  }
});
