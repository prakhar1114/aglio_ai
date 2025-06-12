import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'QRMenuUI',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@egjs/react-infinitegrid', 'clsx', '@qrmenu/core'],
    },
    outDir: 'dist',
    sourcemap: true
  }
}); 