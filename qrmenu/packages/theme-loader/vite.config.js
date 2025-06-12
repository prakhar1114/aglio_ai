import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'QRMenuThemeLoader',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      // No external dependencies for theme-loader
      external: [],
    },
    outDir: 'dist',
    sourcemap: true
  }
}); 