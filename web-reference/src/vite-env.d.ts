/// <reference types="vite/client" />

// Global from Vite define (vite.config.ts / vitest.config.ts) — game version from package.json.
declare const __APP_VERSION__: string

// TURN creds from env (VITE_ prefix → exposed on import.meta.env). Set in .env (gitignored) / CI variables.
interface ImportMetaEnv {
  readonly VITE_TURN_USERNAME?: string
  readonly VITE_TURN_CREDENTIAL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
