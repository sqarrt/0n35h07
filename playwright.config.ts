import { defineConfig, devices } from '@playwright/test'

// Отключаем троттлинг фоновых вкладок Chromium: multiplayer-тесты держат 2 страницы (большинство скрыты),
// и троттлинг таймеров/рендера тормозит ретраи HELLO в LobbySession → флаки на хендшейке под нагрузкой.
const NO_BG_THROTTLE = [
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
]

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
        launchOptions: { args: NO_BG_THROTTLE },
      },
    },
    {
      name: 'headed',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
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
        baseURL: 'http://localhost:5173',
      },
    },
  ],
})
