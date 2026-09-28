import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Vite 8 bundles with Rolldown, which chunks vendor code well on its own.
    // Hand-written chunk groups reordered React's internals and broke hooks at
    // runtime, so the defaults are deliberately left alone here.
    chunkSizeWarningLimit: 1200,
  },
});
