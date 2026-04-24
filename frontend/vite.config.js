import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    basicSsl()
  ],
  server: {
    host: true, // Listen on all local IPs
    strictPort: false, // Automatically find next available port
  }
})
