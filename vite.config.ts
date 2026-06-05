import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { editorMaps } from './vite-plugin-editor-maps'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), editorMaps()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
})
