import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: { build: { rollupOptions: { external: ['sql.js'] } } },
  preload: { build: { rollupOptions: { output: { format: 'cjs' } } } },
  renderer: {
    plugins: [react()],
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    build: { chunkSizeWarningLimit: 1500 },
  },
})
