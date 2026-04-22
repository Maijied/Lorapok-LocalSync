import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Server } from 'socket.io'
import { setupSocket } from '../backend/socketLogic.js'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'socket-io-plugin',
      configureServer(server) {
        const io = new Server(server.httpServer, {
          cors: { origin: '*' }
        });
        setupSocket(io);
      }
    }
  ],
  server: {
    host: true, // Listen on all local IPs
    strictPort: false, // Automatically find next available port
  }
})
