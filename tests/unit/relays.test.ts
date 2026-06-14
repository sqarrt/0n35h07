import { describe, it, expect, beforeEach, vi } from 'vitest'

// jsdom не реализует WebSocket → мокаем. Управляем «живостью» и латентностью по URL.
let isAlive: (url: string) => boolean = () => false
let latencyFor: (url: string) => number = () => 5

// Имитация Nostr-релея: «живой» открывает сокет, принимает REQ+EVENT и эхо-ит наше событие в нашу подписку
// (round-trip), как настоящий релей. «Мёртвый» — onerror. Латентность считается до эхо (≈ latencyFor).
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

// Свежий импорт модуля (у него module-level стор/кеш) после сброса состояния.
async function freshModule() {
  vi.resetModules()
  return import('../../src/net/relays')
}

describe('relays — проба живости и кеш', () => {
  beforeEach(() => {
    localStorage.clear()
    isAlive = () => false
    latencyFor = () => 5
    vi.stubGlobal('WebSocket', FakeWS as unknown as typeof WebSocket)
  })

  it('оставляет только живые релеи, сортирует по латентности, кеширует в localStorage', async () => {
    isAlive = url => url.includes('damus') || url.includes('nos.lol')
    latencyFor = url => (url.includes('damus') ? 1 : 120)
    const { warmRelayCache, getStatus, resolveRelaysSync } = await freshModule()

    const selected = await warmRelayCache()

    expect(selected.length).toBe(2)
    expect(selected.every(u => u.includes('damus') || u.includes('nos.lol'))).toBe(true)
    expect(selected[0]).toContain('damus')   // меньшая латентность — первой

    const status = getStatus()
    expect(status.phase).toBe('done')
    expect(status.results.filter(r => r.alive).length).toBe(2)
    expect(status.results.length).toBeGreaterThan(2)   // пул пробит целиком (живые + мёртвые)

    const cached = JSON.parse(localStorage.getItem(LS_KEY)!)
    expect(cached.urls).toEqual(selected)
    expect(resolveRelaysSync()).toEqual(selected)
  })

  it('никого живого → курируемый фолбэк, localStorage не пишется', async () => {
    isAlive = () => false
    const { warmRelayCache, resolveRelaysSync } = await freshModule()

    const selected = await warmRelayCache()

    expect(selected.length).toBeGreaterThan(0)            // фолбэк непустой
    expect(selected.every(u => u.startsWith('wss://'))).toBe(true)
    expect(localStorage.getItem(LS_KEY)).toBeNull()       // мёртвую пробу не кешируем
    expect(resolveRelaysSync()).toEqual(selected)         // sync тоже отдаёт фолбэк
  })

  it('режет живой набор до лимита KEEP', async () => {
    isAlive = () => true
    const { warmRelayCache } = await freshModule()

    const selected = await warmRelayCache()

    expect(selected.length).toBe(8)   // KEEP
  })

  it('resolveRelaysSync без пробы отдаёт фолбэк', async () => {
    const { resolveRelaysSync } = await freshModule()
    const urls = resolveRelaysSync()
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every(u => u.startsWith('wss://'))).toBe(true)
  })
})
