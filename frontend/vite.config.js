import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // forwards /api/* to the Express backend during dev, so the frontend
      // can just call fetch('/api/...') with no CORS/base-URL juggling
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Real-time balance/activity updates (see backend/src/socket.js).
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
