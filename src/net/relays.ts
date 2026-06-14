import { defaultRelayUrls } from 'trystero'
import { lsGet, lsSet } from '../storage'

/**
 * Живая проба Nostr-релеев сигналинга. Trystero по умолчанию выбирает фиксированную пятёрку релеев по
 * хешу appId — если они мертвы, пиры не находят друг друга. Здесь мы на входе в меню пробим достижимость
 * релеев (WebSocket connect) и в дальнейшем используем только подтверждённые (self-healing), оставляя
 * щедрый поднабор для гарантии пересечения между пирами.
 */

const PROBE_TIMEOUT_MS = 2000      // дедлайн на одиночный WebSocket-connect
const KEEP = 8                     // сколько живых релеев оставить (по возрастанию латентности)
const CACHE_TTL_MS = 10 * 60_000   // свежесть кеша — повторно не пробим в пределах TTL
const LS_KEY = 'oneshot:relays'

/** Курируемый фолбэк: стабильные публичные релеи (с wss://). Используется, если проба не дала живых. */
const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://relay.nostr.band',
  'wss://offchain.pub',
]

export interface RelayResult { url: string; alive: boolean; latencyMs: number | null }
export type RelayPhase = 'idle' | 'probing' | 'done'
export interface RelayStatus {
  phase: RelayPhase
  results: RelayResult[]
  selected: string[]   // итоговый рабочий набор (≤ KEEP), который уходит в Trystero
  ts: number           // время последней успешной пробы (для TTL)
}

type StatusListener = (s: RelayStatus) => void

const candidatePool = Array.from(new Set([...defaultRelayUrls, ...FALLBACK_RELAYS]))

let status: RelayStatus = { phase: 'idle', results: [], selected: [], ts: 0 }
const listeners = new Set<StatusListener>()
let inFlight: Promise<string[]> | null = null

function emit() { for (const l of listeners) l(status) }
function setStatus(patch: Partial<RelayStatus>) { status = { ...status, ...patch }; emit() }

export function getStatus(): RelayStatus { return status }
export function subscribe(cb: StatusListener): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** WebSocket-проба: латентность open в мс, либо null (error/close/таймаут). Сокет закрываем сразу. */
function probeRelay(url: string, timeoutMs: number): Promise<number | null> {
  return new Promise(resolve => {
    let ws: WebSocket
    const started = performance.now()
    let done = false
    const finish = (latency: number | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { ws.close() } catch { /* already closed */ }
      resolve(latency)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    try {
      ws = new WebSocket(url)
    } catch {
      finish(null)
      return
    }
    ws.onopen = () => finish(Math.round(performance.now() - started))
    ws.onerror = () => finish(null)
    ws.onclose = () => finish(null)
  })
}

function readCache(): RelayStatus | null {
  try {
    const raw = lsGet(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { urls: string[]; ts: number }
    if (!Array.isArray(parsed.urls) || !parsed.urls.length) return null
    return { phase: 'done', results: [], selected: parsed.urls, ts: parsed.ts }
  } catch { return null }
}

function writeCache(urls: string[], ts: number) {
  lsSet(LS_KEY, JSON.stringify({ urls, ts }))
}

function isFresh(ts: number): boolean { return Date.now() - ts < CACHE_TTL_MS }

/**
 * Прогреть кеш живых релеев. Свежий кеш (память/localStorage) → без пробы. Иначе пробим весь пул
 * параллельно, оставляем живые (сорт по латентности, до KEEP), кешируем. Нет живых → фолбэк.
 * Параллельные вызовы дедуплицируются.
 */
export function warmRelayCache(): Promise<string[]> {
  if (status.phase === 'done' && status.selected.length && isFresh(status.ts)) {
    return Promise.resolve(status.selected)
  }
  if (inFlight) return inFlight

  const cached = readCache()
  if (cached && isFresh(cached.ts)) {
    status = cached
    emit()
    return Promise.resolve(cached.selected)
  }

  inFlight = doProbe().finally(() => { inFlight = null })
  return inFlight
}

/** Принудительная перепроверка (кнопка «проверить заново» в настройках). */
export function reprobe(): Promise<string[]> {
  if (inFlight) return inFlight
  inFlight = doProbe().finally(() => { inFlight = null })
  return inFlight
}

async function doProbe(): Promise<string[]> {
  setStatus({ phase: 'probing', results: [] })
  const settled = await Promise.all(
    candidatePool.map(async url => ({ url, latencyMs: await probeRelay(url, PROBE_TIMEOUT_MS) })),
  )
  const results: RelayResult[] = settled.map(r => ({ url: r.url, alive: r.latencyMs !== null, latencyMs: r.latencyMs }))
  const selected = results
    .filter(r => r.alive)
    .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))
    .slice(0, KEEP)
    .map(r => r.url)

  const final = selected.length ? selected : FALLBACK_RELAYS
  const ts = Date.now()
  if (selected.length) writeCache(selected, ts)
  setStatus({ phase: 'done', results, selected: final, ts })
  return final
}

/** Синхронно «лучшее доступное» для момента joinRoom: память → localStorage → курируемый фолбэк. */
export function resolveRelaysSync(): string[] {
  if (status.selected.length) return status.selected
  const cached = readCache()
  if (cached) return cached.selected
  return FALLBACK_RELAYS
}
