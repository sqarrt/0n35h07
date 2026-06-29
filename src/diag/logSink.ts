// Desktop-only file sink for diagnostic logs. Batches lines and appends them to a per-session file under
// $APPDATA/logs. Off-desktop every method is an instant no-op. Never throws into callers — disk errors are swallowed.
import { writeTextFile, readDir, remove, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { appDataDir, join as pathJoin } from '@tauri-apps/api/path'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { IS_DESKTOP } from '../platform'
import { LOG_DIR, LOG_KEEP_FILES, LOG_FLUSH_MS, LOG_MAX_BUFFER_LINES } from './constants'
import { sessionFileName } from './logFormat'
import { filesToPrune } from './logRetention'

const opt = { baseDir: BaseDirectory.AppData } as const
const path = (name: string) => `${LOG_DIR}/${name}`

let fileName = ''
let buffer: string[] = []
let flushing: Promise<void> | null = null
let started = false

async function prune(): Promise<void> {
  try {
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
  try { await writeTextFile(path(fileName), chunk, { ...opt, append: true }) }
  catch { /* swallow: logging must never break the app */ }
}

export const logSink = {
  async start(): Promise<void> {
    if (!IS_DESKTOP || started) return
    started = true
    fileName = sessionFileName(new Date())
    try { await mkdir(LOG_DIR, { ...opt, recursive: true }) } catch { /* exists */ }
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
    try { await revealItemInDir(await pathJoin(await appDataDir(), LOG_DIR, fileName)) } catch { /* ignore */ }
  },
}
