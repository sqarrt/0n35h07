import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { editorMaps } from './vite-plugin-editor-maps'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), editorMaps()],
  base: './',
  // Версия игры — build-time из package.json (единый источник правды), в бандл попадает только строка.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
