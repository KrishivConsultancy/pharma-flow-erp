import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/cashfree-proxy': {
        target: 'https://api.cashfree.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cashfree-proxy/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
});
