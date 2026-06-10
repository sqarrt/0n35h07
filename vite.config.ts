import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { editorMaps } from './vite-plugin-editor-maps'
import { cameraPoses } from './vite-plugin-camera-poses'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), editorMaps(), cameraPoses()],
  base: './',
  // Версия игры — build-time из package.json (единый источник правды), в бандл попадает только строка.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Позы камер пишет dev-эндпоинт (vite-plugin-camera-poses) при отпускании J; клиент уже держит
      // их в памяти — HMR на эту запись не нужен и ломал повторные зажатия J (перемонтирование).
      ignored: ['**/menuCameraPoses.json'],
    },
  },
})
