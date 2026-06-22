import { describe, it, expect, beforeEach, vi } from 'vitest'

// jsdom does not implement WebSocket → we mock it. Liveness and latency are controlled by URL.
let isAlive: (url: string) => boolean = () => false
let latencyFor: (url: string) => number = () => 5

// Fake Nostr relay: a "live" one opens the socket, accepts REQ+EVENT and echoes our event back to our
// subscription (round-trip), like a real relay. A "dead" one fires onerror. Latency is measured up to the echo (≈ latencyFor).
class FakeWS {
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  private sub: string | null = null
  constructor(public url: string) {
    if (isAlive(url)) setTimeout(() => this.onopen?.(), latencyFor(url))
    else setTimeout(() => this.onerror?.(), 1)
  }
  send(raw: string) {
    const msg = JSON.parse(raw)
    if (msg[0] === 'REQ') this.sub = msg[1]
    else if (msg[0] === 'EVENT' && this.sub) {
      const evt = msg[1], sub = this.sub
      setTimeout(() => this.onmessage?.({ data: JSON.stringify(['EVENT', sub, evt]) } as MessageEvent), 1)
    }
  }
  close() { /* no-op */ }
}

const LS_KEY = 'oneshot:relays'

// Fresh module import (it has a module-level store/cache) after resetting state.
async function freshModule() {
  vi.resetModules()
  return import('../../src/net/relays')
}

describe('relays — liveness probe and cache', () => {
  beforeEach(() => {
    localStorage.clear()
    isAlive = () => false
    latencyFor = () => 5
    vi.stubGlobal('WebSocket', FakeWS as unknown as typeof WebSocket)
  })

  it('keeps only live relays, sorts by latency, caches in localStorage', async () => {
    isAlive = url => url.includes('damus') || url.includes('nos.lol')
    latencyFor = url => (url.includes('damus') ? 1 : 120)
    const { warmRelayCache, getStatus, resolveRelaysSync } = await freshModule()

    const selected = await warmRelayCache()

    expect(selected.length).toBe(2)
    expect(selected.every(u => u.includes('damus') || u.includes('nos.lol'))).toBe(true)
    expect(selected[0]).toContain('damus')   // lowest latency comes first

    const status = getStatus()
    expect(status.phase).toBe('done')
    expect(status.results.filter(r => r.alive).length).toBe(2)
    expect(status.results.length).toBeGreaterThan(2)   // whole pool was probed (live + dead)

    const cached = JSON.parse(localStorage.getItem(LS_KEY)!)
    expect(cached.urls).toEqual(selected)
    expect(resolveRelaysSync()).toEqual(selected)
  })

  it('none alive → curated fallback, localStorage not written', async () => {
    isAlive = () => false
    const { warmRelayCache, resolveRelaysSync } = await freshModule()

    const selected = await warmRelayCache()

    expect(selected.length).toBeGreaterThan(0)            // fallback is non-empty
    expect(selected.every(u => u.startsWith('wss://'))).toBe(true)
    expect(localStorage.getItem(LS_KEY)).toBeNull()       // a dead probe is not cached
    expect(resolveRelaysSync()).toEqual(selected)         // sync also returns the fallback
  })

  it('trims the live set down to the KEEP limit', async () => {
    isAlive = () => true
    const { warmRelayCache } = await freshModule()

    const selected = await warmRelayCache()

    expect(selected.length).toBe(8)   // KEEP
  })

  it('resolveRelaysSync without a probe returns the fallback', async () => {
    const { resolveRelaysSync } = await freshModule()
    const urls = resolveRelaysSync()
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every(u => u.startsWith('wss://'))).toBe(true)
  })
})
