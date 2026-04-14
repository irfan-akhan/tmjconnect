import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  build: {
    // Bump the warning ceiling — even after splitting, antd + recharts is heavy
    // and we don't want a noise warning for ~600 KB chunks.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Manual vendor chunks. Splits the three biggest dependency islands so
        // dashboard / users / audit pages don't all load every chart library.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-recharts': ['recharts'],
          'vendor-dayjs': ['dayjs'],
          'vendor-axios': ['axios'],
        },
      },
    },
  },
});
