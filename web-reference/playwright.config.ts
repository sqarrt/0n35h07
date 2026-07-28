import { defineConfig, devices } from '@playwright/test'

// E2E_PORT lets the suite run side-by-side with a developer's live dev server on 5173
// (WSL: a Windows-side listener blocks the default port for the test-owned Vite).
const PORT = Number(process.env.E2E_PORT ?? 5173)
const BASE_URL = `http://localhost:${PORT}`

// Disable Chromium background tab throttling: multiplayer tests keep 2 pages (most of them hidden),
// and timer/render throttling slows HELLO retries in LobbySession → handshake flakiness under load.
const NO_BG_THROTTLE = [
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
]

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/unit/**'],
  // Worker cap: each e2e loads Rapier WASM; under heavy parallelism CPU contention causes frame jank
  // and flakiness in timing-dependent checks (dash/shield/jump/collisions).
  // CI runners (2 cores, software-rendered WebGL via SwiftShader) can't take parallelism at all —
  // 1 worker there avoids the contention that otherwise blows past the timeouts. Locally 4 is fine.
  workers: process.env.CI ? 1 : 4,
  // Retries — a standard measure for timing-dependent physics e2e under load.
  retries: 2,
  // Software WebGL in CI is an order of magnitude slower than a local GPU → generous timeouts there.
  timeout: process.env.CI ? 120_000 : 30_000,
  expect: { timeout: process.env.CI ? 20_000 : 5_000 },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,   // cold Vite dev-server start + first-load module transform on a CI runner
  },
  projects: [
    {
      name: 'headless',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL,
        headless: true,
        launchOptions: { args: NO_BG_THROTTLE },
      },
    },
    {
      name: 'headed',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL,
        headless: false,
        launchOptions: { args: NO_BG_THROTTLE },
      },
    },
    {
      // Connects to an already-open Chrome browser.
      // Start Chrome with: --remote-debugging-port=9222
      // Or set CDP_PORT env var to match.
      name: 'connected',
      use: {
        baseURL: BASE_URL,
      },
    },
  ],
})
