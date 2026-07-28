export type LogLevel = 'info' | 'warn' | 'error'
export type LogCat =
  | 'life' | 'transport' | 'mm' | 'room' | 'nego' | 'phase' | 'act' | 'health' | 'ice' | 'steam'

const LEVEL_CHAR: Record<LogLevel, string> = { info: 'I', warn: 'W', error: 'E' }

function fmtVal(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000)
  if (Array.isArray(v)) return `[${v.map(fmtVal).join(',')}]`
  if (typeof v === 'string') return /\s|=/.test(v) ? `"${v}"` : v
  if (v === null || v === undefined) return String(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function fmtFields(fields?: Record<string, unknown>): string {
  if (!fields) return ''
  return Object.keys(fields).map(k => `${k}=${fmtVal(fields[k])}`).join(' ')
}

export function formatLine(
  tsIso: string, sinceMs: number, level: LogLevel, cat: string, event: string, fields?: Record<string, unknown>,
): string {
  const head = `${tsIso} +${sinceMs} ${LEVEL_CHAR[level]} ${cat} ${event}`
  const tail = fmtFields(fields)
  return tail ? `${head} ${tail}` : head
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n) }

/** `oneshot-YYYYMMDD-HHMMSS.log` in LOCAL time — sortable, one per session. */
export function sessionFileName(now: Date): string {
  const d = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
  const t = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  return `oneshot-${d}-${t}.log`
}
