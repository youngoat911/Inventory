import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // target: 'http://localhost:3000',
           target: 'http://172.31.50.236:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://172.31.50.236:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://172.31.50.236:3000',
        ws: true,
      },
    },
  },
})
