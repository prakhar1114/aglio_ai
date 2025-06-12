import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify('http://192.168.1.3:8005'),
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