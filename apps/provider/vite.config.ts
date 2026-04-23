import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    // Writes dist/stats.html on build — open it to inspect bundle composition.
    visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5174,
    proxy: {
      // VITE_PROXY_TARGET lets the container reach the API via the compose
      // network (http://api:3000). Host dev keeps the localhost default.
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Hand-picked chunks for predictable caching. The visualizer reveals
        // which of these actually pay off in practice.
        manualChunks: {
          'react': ['react', 'react-dom', 'react-router-dom'],
          'query': ['@tanstack/react-query'],
          'radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
          ],
          'cmdk': ['cmdk'],
          'date': ['date-fns'],
          'icons': ['lucide-react'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'toast': ['sonner'],
        },
      },
    },
  },
});
