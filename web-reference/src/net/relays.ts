import { defaultRelayUrls } from 'trystero'
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure'
import { lsGet, lsSet } from '../storage'

/**
 * Live probing of Nostr signaling relays. By default Trystero picks a fixed set of five relays by the
 * appId hash — if they're dead, peers can't find each other. Here, on entering the menu, we probe relay
 * reachability (WebSocket connect) and from then on use only confirmed ones (self-healing), keeping a
 * generous subset to guarantee overlap between peers.
 */

const PROBE_TIMEOUT_MS = 3000      // deadline for one probe (open + publish/subscribe round-trip)
const PROBE_KIND = 20009           // ephemeral kind (NIP-01): the relay doesn't store but broadcasts to active subscribers
const KEEP = 8                     // how many live relays to keep (by ascending latency)
const CACHE_TTL_MS = 10 * 60_000   // cache freshness — don't re-probe within the TTL
const LS_KEY = 'oneshot:relays'

/** Curated fallback: stable public relays (with wss://). Used if the probe found none alive. */
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
  selected: string[]   // final working set (≤ KEEP) that goes to Trystero
  ts: number           // time of the last successful probe (for TTL)
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

/**
 * Functional relay probe (not just "did the socket open"): open the WS, subscribe (REQ) and publish an
 * ephemeral event; "alive" = the relay returned OUR event to OUR subscription, i.e. it really ACCEPTS and
 * FORWARDS (exactly what Trystero signaling needs). Relays that open a socket but drop/don't forward events
 * are filtered out — otherwise, with explicit roles (one-way discovery), the only delivery path breaks.
 * @returns round-trip latency in ms, or null (error/close/rejection/timeout).
 */
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
    const subId = crypto.randomUUID()
    const tag = crypto.randomUUID()   // unique 'd' tag → the probe doesn't catch other traffic
    let evtId = ''
    ws.onopen = () => {
      try {
        const evt = finalizeEvent(
          { kind: PROBE_KIND, created_at: Math.floor(Date.now() / 1000), tags: [['d', tag]], content: '' },
          generateSecretKey(),
        )
        evtId = evt.id
        ws.send(JSON.stringify(['REQ', subId, { kinds: [PROBE_KIND], '#d': [tag] }]))
        ws.send(JSON.stringify(['EVENT', evt]))
      } catch { finish(null) }
    }
    ws.onmessage = (e: MessageEvent) => {
      let msg: unknown
      try { msg = JSON.parse(typeof e.data === 'string' ? e.data : '') } catch { return }
      if (!Array.isArray(msg)) return
      // The relay returned our event to our subscription → it accepts and forwards.
      if (msg[0] === 'EVENT' && msg[1] === subId && (msg[2] as { id?: string })?.id === evtId) {
        finish(Math.round(performance.now() - started))
      } else if ((msg[0] === 'OK' && msg[1] === evtId && msg[2] === false) || (msg[0] === 'CLOSED' && msg[1] === subId)) {
        finish(null)   // explicit publish/subscribe rejection
      }
    }
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
 * Warm the cache of live relays. Fresh cache (memory/localStorage) → no probe. Otherwise probe the whole
 * pool in parallel, keep the live ones (sorted by latency, up to KEEP), cache them. None alive → fallback.
 * Concurrent calls are deduplicated.
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

/** Forced re-check (the "check again" button in settings). */
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

/** Synchronous "best available" at joinRoom time: memory → localStorage → curated fallback. */
export function resolveRelaysSync(): string[] {
  if (status.selected.length) return status.selected
  const cached = readCache()
  if (cached) return cached.selected
  return FALLBACK_RELAYS
}
