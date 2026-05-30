import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
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
