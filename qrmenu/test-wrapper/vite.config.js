import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify('http://192.168.1.103:8005'),
    'import.meta.env.VITE_WS_BASE': JSON.stringify('ws://192.168.1.103:8005'),
    'import.meta.env.VITE_RESTAURANT_SLUG': JSON.stringify('handcrafted'),
    // 'import.meta.env.VITE_API_BASE': JSON.stringify('http://172.20.10.2:8005'),
  },
  build: {
    // Test wrapper is an app, not a library, so bundle everything
    rollupOptions: {
      // Don't externalize anything for the test wrapper
      external: []
    }
  },
  resolve: {
    alias: {
      '@qrmenu/core': path.resolve('../packages/core/src'),
      '@qrmenu/theme-loader': path.resolve('../packages/theme-loader/src'),
      '@qrmenu/ui': path.resolve('../packages/ui/src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'],
  },
}); 