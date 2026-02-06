import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.VITE_ZOELIBRARYAPP_DEV_PORT) || 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_ZOELIBRARYAPP_API_URL || 'http://localhost:5002',
        changeOrigin: true,
      }
    }
  }
})
