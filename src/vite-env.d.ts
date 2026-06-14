/// <reference types="vite/client" />

// Глобал из Vite define (vite.config.ts / vitest.config.ts) — версия игры из package.json.
declare const __APP_VERSION__: string

// TURN-креды из env (VITE_-префикс → попадают в import.meta.env). Заданы в .env (gitignored) / CI-variables.
interface ImportMetaEnv {
  readonly VITE_TURN_USERNAME?: string
  readonly VITE_TURN_CREDENTIAL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
