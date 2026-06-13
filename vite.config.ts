import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { editorMaps } from './vite-plugin-editor-maps'
import { cameraPoses } from './vite-plugin-camera-poses'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    editorMaps(),
    cameraPoses(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '0N35H07',
        short_name: '0N35H07',
        description: 'Аркадный шутер от первого лица, строго 1v1 (p2p)',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'fullscreen',
        start_url: '.',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: [],
      },
    }),
  ],
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
