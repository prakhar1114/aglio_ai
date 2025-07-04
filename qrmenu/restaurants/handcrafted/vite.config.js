import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // ✅ Configure these variables for your restaurant
    'import.meta.env.VITE_API_BASE': JSON.stringify(process.env.VITE_API_BASE || 'http://192.168.1.103:8005'),
    'import.meta.env.VITE_WS_BASE': JSON.stringify(process.env.VITE_WS_BASE || 'ws://192.168.1.103:8005'),
    'import.meta.env.VITE_RESTAURANT_SLUG': JSON.stringify(process.env.VITE_RESTAURANT_SLUG || 'handcrafted'),
    'import.meta.env.VITE_RESTAURANT_NAME': JSON.stringify(process.env.VITE_RESTAURANT_NAME || 'Handcrafted Cafe'),
    'import.meta.env.VITE_CLOUDFLARE_IMAGES_ACCOUNT_HASH': JSON.stringify(process.env.VITE_CLOUDFLARE_IMAGES_ACCOUNT_HASH || 'J-YAzqh0xCiR5OJtQewXmg'),
    'import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE': JSON.stringify(process.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE || 'd8d0zszz3k5df3a6'),
  },
  build: {
    rollupOptions: {
      external: []
    }
  },
  resolve: {
    alias: {
      '@qrmenu/core': path.resolve('../../packages/core/src'),
      '@qrmenu/theme-loader': path.resolve('../../packages/theme-loader/src'),
      '@qrmenu/ui': path.resolve('../../packages/ui/src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'],
  },
});
