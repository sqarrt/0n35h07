import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { editorMaps } from './build/vite-plugins/editorMaps'
import { cameraPoses } from './build/vite-plugins/cameraPoses'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Desktop build runs via `vite build --mode tauri` (see beforeBuildCommand in tauri.conf.json):
  // an explicit mode is more reliable than guessing from env (TAURI_ENV_* isn't set in every environment).
  // On desktop PWA isn't needed — assets are already local, and the WebView2 service worker caches them
  // persistently and serves the OLD version after an update (stuck on the previous build). TAURI_ENV_PLATFORM
  // is a fallback signal.
  const isTauriBuild = mode === 'tauri' || !!process.env.TAURI_ENV_PLATFORM
  return {
    plugins: [
      react(),
      editorMaps(),
      cameraPoses(),
      VitePWA({
        // In the Tauri build — a self-destroying SW: removes the previously registered SW and clears caches
        // (heals already installed copies), caching nothing itself. On the web it stays a regular PWA.
        selfDestroying: isTauriBuild,
        registerType: 'autoUpdate',
        manifest: {
          name: '0N35H07',
          short_name: '0N35H07',
          description: 'An arcade first-person shooter, strictly 1v1, peer-to-peer',
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
    // Game version — build-time from package.json (single source of truth); only the string lands in the bundle.
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      rolldownOptions: {
        output: {
          // Split the bundle into cacheable chunks: vendor libraries change less often than game code →
          // each deploy reloads only index.js, the rest stays in the browser cache.
          codeSplitting: {
            groups: [
              // Three.js — the largest library; its own chunk, rarely changes.
              { name: 'three',   test: /node_modules[\\/](three|three-mesh-bvh)[\\/]/, priority: 30 },
              // React Three Fiber + Rapier (physics) — the 3D infrastructure.
              { name: 'r3f',     test: /node_modules[\\/](@react-three|@dimforge)[\\/]/, priority: 25 },
              // React core — almost never changes between game versions.
              { name: 'react',   test: /node_modules[\\/]react(-dom)?[\\/]/, priority: 20 },
              // Everything else from node_modules (trystero, nostr-tools, @tauri-apps, …).
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
        // Camera poses are written by a dev endpoint (vite-plugin-camera-poses) when J is released; the client
        // already holds them in memory — HMR on this write isn't needed and broke repeated J holds (remount).
        ignored: ['**/menuCameraPoses.json'],
      },
    },
  }
})
