import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [
    react(),
  ],
  server: {
    host: true, // Listen on all local IPs
    strictPort: false, // Automatically find next available port
  }
})
