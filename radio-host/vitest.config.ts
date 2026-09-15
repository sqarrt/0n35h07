import { defineConfig } from 'vitest/config'

// The radio's unit tests, in the environment the web game ran them in (jsdom, vitest globals).
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    globals: true,
  },
})
