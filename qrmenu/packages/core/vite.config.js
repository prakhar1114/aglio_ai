import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'QRMenuCore',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand'],
    },
    outDir: 'dist',
    sourcemap: true
  },
}); 