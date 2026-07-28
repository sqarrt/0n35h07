import { describe, it, expect, afterEach } from 'vitest'
import { MatchMusic } from '../../src/game/audio/MatchMusic'
import type { IMusicEngine, Arrangement, StemLibrary } from '../../src/game/audio/types'

const far = () => 10 * 60_000   // far from the end → intro at the start

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
  /** Silence: no stems are actually playing in the fake. */
  readLevel() { return 0 }
  /** Silent spectrum — zero the caller's buffer (it may be reused across frames). */
  readBands(out: Float32Array) { out.fill(0) }
}

afterEach(() => { delete window.__debugMusic })

describe('MatchMusic', () => {
  it('start(): load first, then start with provider', async () => {
    const eng = new FakeEngine()
    await new MatchMusic('AB12', eng, far).start()
    expect(eng.loadCalls).toBe(1)
    expect(eng.startCalls).toBe(1)
    expect(eng.provider).toBeTypeOf('function')
  })

  it('provider yields a deterministic intro arrangement (kicks+bass) at loop 0', async () => {
    const eng = new FakeEngine()
    await new MatchMusic('AB12', eng, far).start()
    const roles = eng.provider!(0).map(v => v.role).sort()
    expect(roles).toEqual(['bass', 'kicks'])
  })

  it('same code → same provider output (seed-driven determinism)', async () => {
    const e1 = new FakeEngine(); await new MatchMusic('ZZZZ', e1, far).start()
    const e2 = new FakeEngine(); await new MatchMusic('ZZZZ', e2, far).start()
    expect(e1.provider!(3)).toEqual(e2.provider!(3))
  })

  it('start() is idempotent', async () => {
    const eng = new FakeEngine()
    const m = new MatchMusic('AB12', eng, far)
    await m.start(); await m.start()
    expect(eng.startCalls).toBe(1)
  })

  it('__debugMusic is set in start() (not in the constructor) and cleared in dispose()', async () => {
    const eng = new FakeEngine()
    const m = new MatchMusic('AB12', eng, far)
    expect(window.__debugMusic).toBeUndefined()   // constructor does NOT touch the global (StrictMode-safe)
    await m.start()
    expect(window.__debugMusic).toBeTypeOf('function')
    m.dispose()
    expect(window.__debugMusic).toBeUndefined()
  })
})
