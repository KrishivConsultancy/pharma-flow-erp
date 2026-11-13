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
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/sql.js/')) {
            return 'vendor-sql';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
