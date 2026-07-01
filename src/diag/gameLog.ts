import { logSink } from './logSink'
import { formatLine, type LogCat, type LogLevel } from './logFormat'
import { IS_DESKTOP } from '../platform'
import { isSteamAvailable } from '../steam/steam'
import { APP_ID } from '../net/TrysteroNet'
import { CLIENT_VERSION, CLIENT_PLATFORM } from '../net/poolNamespace'

const T0 = (typeof performance !== 'undefined') ? performance.now() : 0
const since = () => Math.round(((typeof performance !== 'undefined') ? performance.now() : 0) - T0)

const header: Record<string, unknown> = {}
let active = false   // logging is enabled ONLY on the Steam build (set after the Steam-availability check in installGameLog)

function emit(level: LogLevel, cat: LogCat, event: string, fields?: Record<string, unknown>): void {
  if (!active) return
  try { logSink.enqueue(formatLine(new Date().toISOString(), since(), level, cat, event, fields)) }
  catch { /* never throw into a caller */ }
}

export const gameLog = {
  set(fields: Record<string, unknown>): void {
    Object.assign(header, fields)
    emit('info', 'life', 'ctx', fields)   // also record the context change inline
  },
  log(cat: LogCat, event: string, fields?: Record<string, unknown>): void { emit('info', cat, event, fields) },
  warn(cat: LogCat, event: string, fields?: Record<string, unknown>): void { emit('warn', cat, event, fields) },
  error(cat: LogCat, event: string, fields?: Record<string, unknown>): void { emit('error', cat, event, fields) },
  flush(): Promise<void> { return logSink.flush() },
  revealDir(): Promise<void> { return logSink.reveal() },
}

/** Once, at startup: enable logging ONLY on the Steam build, open the session file, write the header,
 *  hook uncaught errors, flush on exit. The browser build (and a non-Steam desktop run) writes nothing. */
export async function installGameLog(): Promise<void> {
  if (!IS_DESKTOP) return
  if (!(await isSteamAvailable())) return   // Steam-version only — no logs in the browser / without Steam
  active = true
  await logSink.start()
  emit('info', 'life', 'session_start', {
    version: CLIENT_VERSION, appId: APP_ID, platform: CLIENT_PLATFORM,
    ua: (typeof navigator !== 'undefined') ? navigator.userAgent : '',
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('error', e => emit('error', 'life', 'uncaught', { msg: String(e.message), src: e.filename, line: e.lineno }))
    window.addEventListener('unhandledrejection', e => emit('error', 'life', 'unhandled_rejection', { reason: String((e as PromiseRejectionEvent).reason) }))
    window.addEventListener('beforeunload', () => { void logSink.flush() })
  }
}
