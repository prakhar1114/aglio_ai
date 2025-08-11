import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Define both for compatibility with core API helpers
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || process.env.VITE_API_BASE || 'http://localhost:8005'),
    'import.meta.env.VITE_API_BASE': JSON.stringify(process.env.VITE_API_BASE || process.env.VITE_API_BASE_URL || 'http://localhost:8005'),
    'import.meta.env.VITE_WS_BASE': JSON.stringify(process.env.VITE_WS_BASE || 'ws://localhost:8005'),
    'import.meta.env.VITE_CLOUDFLARE_IMAGES_ACCOUNT_HASH': JSON.stringify(process.env.VITE_CLOUDFLARE_IMAGES_ACCOUNT_HASH || 'J-YAzqh0xCiR5OJtQewXmg'),
    'import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE': JSON.stringify(process.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE || 'd8d0zszz3k5df3a6'),
    'import.meta.env.VITE_RESTAURANT_SLUG': JSON.stringify(process.env.VITE_RESTAURANT_SLUG || ''),
    'import.meta.env.VITE_RESTAURANT_NAME': JSON.stringify(process.env.VITE_RESTAURANT_NAME || '')
  },
})
