import { defineConfig } from 'vite'
import { existsSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Builds the radio engine page for the Godot port (spec docs/superpowers/specs/2026-09-15-godot-radio-design.md): the
 * web RadioController + StrudelWebEngine behind src/radio/host/hostProtocol, emitted into the Godot project's
 * localhost/radio_host/. godot_wry serves res://localhost/ from http://res.localhost — a secure context, so Strudel's
 * AudioWorklets load (any other res:// directory is plain http and has no AudioWorklet).
 *
 * Rebuild: npm run build (in radio-host/)  →  commit localhost/radio_host/.
 */
const ROOT = process.cwd()
const OUT = resolve(ROOT, '../localhost/radio_host')
const PAGE = 'radio-host.html'
const INDEX = 'index.html'
const BUNDLE_LIMIT_KB = 1024   // one local bundle on purpose (Strudel with its worklets inlined, ~720 kB): no split

export default defineConfig({
  root: ROOT,
  base: './',
  publicDir: false,   // the banks are imported into the bundle; nothing else from public/ is needed
  plugins: [{
    name: 'radio-host-index',
    closeBundle() {   // WebView loads res://localhost/radio_host/index.html
      if (existsSync(resolve(OUT, PAGE))) renameSync(resolve(OUT, PAGE), resolve(OUT, INDEX))
    },
  }],
  build: {
    outDir: OUT,
    emptyOutDir: true,
    chunkSizeWarningLimit: BUNDLE_LIMIT_KB,
    rollupOptions: { input: resolve(ROOT, PAGE) },
  },
})
