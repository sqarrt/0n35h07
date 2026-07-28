// Desktop-only file sink for diagnostic logs. Batches lines and appends them to a per-session file under
// $APPDATA/logs. Off-desktop every method is an instant no-op. Never throws into callers — disk errors are swallowed.
// The @tauri-apps/* modules are imported LAZILY (inside the desktop-gated methods) so that merely importing the
// logger never pulls native Tauri deps into the browser bundle or unit tests.
import { IS_DESKTOP } from '../platform'
import { LOG_DIR, LOG_KEEP_FILES, LOG_FLUSH_MS, LOG_MAX_BUFFER_LINES } from './constants'
import { sessionFileName } from './logFormat'
import { filesToPrune } from './logRetention'

const path = (name: string) => `${LOG_DIR}/${name}`

let fileName = ''
let buffer: string[] = []
let flushing: Promise<void> | null = null
let started = false

async function prune(): Promise<void> {
  try {
    const { readDir, remove, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    const opt = { baseDir: BaseDirectory.AppData } as const
    const entries = await readDir(LOG_DIR, opt)
    for (const name of filesToPrune(entries.map(e => e.name), LOG_KEEP_FILES)) {
      await remove(path(name), opt)
    }
  } catch { /* dir may not exist yet / unreadable — ignore */ }
}

async function doFlush(): Promise<void> {
  if (!buffer.length) return
  const chunk = buffer.join('\n') + '\n'
  buffer = []
  try {
    const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(path(fileName), chunk, { baseDir: BaseDirectory.AppData, append: true })
  } catch { /* swallow: logging must never break the app */ }
}

export const logSink = {
  async start(): Promise<void> {
    if (!IS_DESKTOP || started) return
    started = true
    fileName = sessionFileName(new Date())
    try {
      const { mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      await mkdir(LOG_DIR, { baseDir: BaseDirectory.AppData, recursive: true })
    } catch { /* exists */ }
    await prune()
    setInterval(() => { void logSink.flush() }, LOG_FLUSH_MS)   // lives for the whole session (no teardown)
  },
  enqueue(line: string): void {
    if (!IS_DESKTOP || !started) return
    buffer.push(line)
    if (buffer.length >= LOG_MAX_BUFFER_LINES) void logSink.flush()
  },
  async flush(): Promise<void> {
    if (!IS_DESKTOP) return
    if (flushing) return flushing
    flushing = doFlush().finally(() => { flushing = null })
    return flushing
  },
  async reveal(): Promise<void> {
    if (!IS_DESKTOP) return
    try {
      const { appDataDir, join } = await import('@tauri-apps/api/path')
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      await revealItemInDir(await join(await appDataDir(), LOG_DIR, fileName))
    } catch { /* ignore */ }
  },
}
