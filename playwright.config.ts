import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/unit/**'],
  // Кэп воркеров: каждый e2e грузит Rapier WASM; при большом параллелизме CPU-контеншн
  // вызывает джанк кадров и флаки таймингозависимых проверок (дэш/щит/прыжок/коллизии).
  workers: 4,
  // Ретраи — стандартная мера для таймингозависимых физических e2e под нагрузкой.
  retries: 2,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'headless',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
        headless: true,
      },
    },
    {
      name: 'headed',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
        headless: false,
      },
    },
    {
      // Connects to an already-open Chrome browser.
      // Start Chrome with: --remote-debugging-port=9222
      // Or set CDP_PORT env var to match.
      name: 'connected',
      use: {
        baseURL: 'http://localhost:5173',
      },
    },
  ],
})
