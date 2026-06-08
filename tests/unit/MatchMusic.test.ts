import { describe, it, expect, afterEach } from 'vitest'
import { MatchMusic } from '../../src/game/audio/MatchMusic'
import type { IMusicEngine, Arrangement, StemLibrary } from '../../src/game/audio/types'

const far = () => 10 * 60_000   // далеко до конца → интро на старте

class FakeEngine implements IMusicEngine {
  loadCalls = 0
  startCalls = 0
  provider: ((loopIndex: number) => Arrangement) | null = null
  loopIndex = 0
  async load(_lib: StemLibrary) { this.loadCalls++ }
  async start(provider: (i: number) => Arrangement) { this.startCalls++; this.provider = provider }
  fadeOut() {}
  stop() {}
  setMasterGain() {}
  dispose() {}
  activeStemIds() { return [] }
}

afterEach(() => { delete window.__debugMusic })

describe('MatchMusic', () => {
  it('start(): сначала load, потом start с provider', async () => {
    const eng = new FakeEngine()
    await new MatchMusic('AB12', eng, far).start()
    expect(eng.loadCalls).toBe(1)
    expect(eng.startCalls).toBe(1)
    expect(eng.provider).toBeTypeOf('function')
  })

  it('provider даёт детерминированную интро-аранжировку (kicks+bass) на loop 0', async () => {
    const eng = new FakeEngine()
    await new MatchMusic('AB12', eng, far).start()
    const roles = eng.provider!(0).map(v => v.role).sort()
    expect(roles).toEqual(['bass', 'kicks'])
  })

  it('одинаковый код → одинаковый provider-выход (детерминизм от сида)', async () => {
    const e1 = new FakeEngine(); await new MatchMusic('ZZZZ', e1, far).start()
    const e2 = new FakeEngine(); await new MatchMusic('ZZZZ', e2, far).start()
    expect(e1.provider!(3)).toEqual(e2.provider!(3))
  })

  it('start() идемпотентен', async () => {
    const eng = new FakeEngine()
    const m = new MatchMusic('AB12', eng, far)
    await m.start(); await m.start()
    expect(eng.startCalls).toBe(1)
  })

  it('__debugMusic ставится в start() (не в конструкторе) и снимается в dispose()', async () => {
    const eng = new FakeEngine()
    const m = new MatchMusic('AB12', eng, far)
    expect(window.__debugMusic).toBeUndefined()   // конструктор НЕ трогает глобал (StrictMode-safe)
    await m.start()
    expect(window.__debugMusic).toBeTypeOf('function')
    m.dispose()
    expect(window.__debugMusic).toBeUndefined()
  })
})
