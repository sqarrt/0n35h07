import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { editorMaps } from './build/vite-plugins/editorMaps'
import { cameraPoses } from './build/vite-plugins/cameraPoses'
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,opus,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  base: './',
  // Версия игры — build-time из package.json (единый источник правды), в бандл попадает только строка.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rolldownOptions: {
      output: {
        // Разбиваем бандл на кэшируемые чанки: vendor-библиотеки меняются реже игрового кода →
        // при каждом деплое перезагружается только index.js, остальное остаётся в кэше браузера.
        codeSplitting: {
          groups: [
            // Three.js — самая крупная библиотека; отдельный чанк, меняется редко.
            { name: 'three',   test: /node_modules[\\/](three|three-mesh-bvh)[\\/]/, priority: 30 },
            // React Three Fiber + Rapier (physics) — инфраструктура 3D.
            { name: 'r3f',     test: /node_modules[\\/](@react-three|@dimforge)[\\/]/, priority: 25 },
            // React core — почти никогда не меняется между версиями игры.
            { name: 'react',   test: /node_modules[\\/]react(-dom)?[\\/]/, priority: 20 },
            // Всё остальное из node_modules (trystero, nostr-tools, @tauri-apps, …).
            { name: 'vendor',  test: /node_modules/, priority: 10 },
          ],
        },
      },
    },
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
