import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
  },
  define: {
    // sockjs-client dùng biến global của Node — polyfill cho browser
    global: 'globalThis',
  },
})
