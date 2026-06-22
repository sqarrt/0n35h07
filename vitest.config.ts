import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

export default defineConfig({
  plugins: [react()],
  // Game version — same as in vite.config.ts (configs are independent, single source — package.json).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    globals: true,
  },
})
