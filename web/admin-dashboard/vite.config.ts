import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const devApiProxyTarget =
  process.env.VITE_DEV_API_PROXY_TARGET || 'http://127.0.0.1:8011';

export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: devApiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          return undefined;
        },
      },
    },
  },
});
