import { describe, it, expect, vi, afterEach } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { IMusicEngine, Arrangement, StemLibrary } from '../../src/game/audio/types'
import type { RosterEntry } from '../../src/net/protocol'

class FakeEngine implements IMusicEngine {
  startCalls = 0
  loopIndex = 0
  async load(_lib: StemLibrary) {}
  async start(_p: (i: number) => Arrangement) { this.startCalls++ }
  fadeOut() {}
  stop() {}
  setMasterGain() {}
  dispose() {}
  activeStemIds() { return [] }
  readLevel() { return 0 }
  readBands() {}
}

function makeMatch(opts: { seedCode?: string; musicEngine?: IMusicEngine }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const controls = { current: { pointerSpeed: 1 } }
  const keys = { current: { forward: false, back: false, left: false, right: false } }
  const roster: RosterEntry[] = [
    { id: 0, name: 'You', color: '#4af', kind: 'human' },
    { id: 1, name: 'Bot', color: '#5af', kind: 'bot', difficulty: 'passive' },
  ]
  return new Match({
    scene, camera, controls: controls as any, keys: keys as any, dispatch: vi.fn(),
    role: 'host', netConfig: { localId: 0, roster }, ...opts,
  })
}

afterEach(() => { delete window.__debugMusic })

describe('Match × music', () => {
  it('without musicEngine no music is created, update does not throw', () => {
    const m = makeMatch({})
    m.forceLiveForTest()
    expect(() => m.update(0.016)).not.toThrow()
    expect(window.__debugMusic).toBeUndefined()
  })

  it('with a seed and engine starts music on entering live, sets __debugMusic', async () => {
    const eng = new FakeEngine()
    const m = makeMatch({ seedCode: 'AB12', musicEngine: eng })
    expect(window.__debugMusic).toBeUndefined()   // no global before live
    m.forceLiveForTest()
    m.update(0.016)
    await vi.waitFor(() => expect(eng.startCalls).toBe(1))
    expect(window.__debugMusic).toBeTypeOf('function')
  })

  it('music does NOT start during the countdown — only after it (entering live)', async () => {
    const eng = new FakeEngine()
    const m = makeMatch({ seedCode: 'AB12', musicEngine: eng })
    m.markReady(0)                    // both ready (bot auto-ready) → countdown phase
    expect(m.phase).toBe('countdown') // we are in the countdown
    m.update(0.016)
    await Promise.resolve()           // give the async start() a chance (if it had been called)
    expect(eng.startCalls).toBe(0)    // no music during the countdown
    m.forceLiveForTest()              // countdown done → live
    m.update(0.016)
    await vi.waitFor(() => expect(eng.startCalls).toBe(1))   // music started only now
  })

  it('dispose() clears __debugMusic', async () => {
    const m = makeMatch({ seedCode: 'AB12', musicEngine: new FakeEngine() })
    m.forceLiveForTest()
    m.update(0.016)
    await vi.waitFor(() => expect(window.__debugMusic).toBeTypeOf('function'))
    m.dispose()
    expect(window.__debugMusic).toBeUndefined()
  })
})
