import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: { proxy: { '/api': process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:3000' } },
  plugins: [react(), tailwindcss(), checker({ typescript: true })],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
