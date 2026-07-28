// Diagnostic logging tunables (dir-level: used across src/diag and the instrumented call sites).
export const LOG_DIR = 'logs'                 // under $APPDATA
export const LOG_KEEP_FILES = 15              // retention: keep this many newest session files, prune the rest on startup
export const LOG_FLUSH_MS = 1000              // batched flush cadence
export const LOG_MAX_BUFFER_LINES = 400       // force a flush if the buffer grows past this between ticks
export const HEALTH_HEARTBEAT_MS = 2000       // period of the in-match net-health line
export const PHASE_WATCHDOG_MS = 8000         // warn if still stuck in ready/countdown after this long
