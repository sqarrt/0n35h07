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
}

function makeMatch(opts: { seedCode?: string; musicEngine?: IMusicEngine }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const controls = { current: { pointerSpeed: 1 } }
  const keys = { current: { forward: false, back: false, left: false, right: false } }
  const roster: RosterEntry[] = [
    { id: 0, name: 'Вы', color: '#4af', kind: 'human' },
    { id: 1, name: 'Бот', color: '#5af', kind: 'bot', difficulty: 'passive' },
  ]
  return new Match({
    scene, camera, controls: controls as any, keys: keys as any, dispatch: vi.fn(),
    role: 'host', netConfig: { localId: 0, roster }, ...opts,
  })
}

afterEach(() => { delete window.__debugMusic })

describe('Match × музыка', () => {
  it('без musicEngine музыка не создаётся, update не падает', () => {
    const m = makeMatch({})
    m.forceLiveForTest()
    expect(() => m.update(0.016)).not.toThrow()
    expect(window.__debugMusic).toBeUndefined()
  })

  it('с сидом и движком стартует музыку при входе в live, ставит __debugMusic', async () => {
    const eng = new FakeEngine()
    const m = makeMatch({ seedCode: 'AB12', musicEngine: eng })
    expect(window.__debugMusic).toBeUndefined()   // до live глобала нет
    m.forceLiveForTest()
    m.update(0.016)
    await vi.waitFor(() => expect(eng.startCalls).toBe(1))
    expect(window.__debugMusic).toBeTypeOf('function')
  })

  it('dispose() снимает __debugMusic', async () => {
    const m = makeMatch({ seedCode: 'AB12', musicEngine: new FakeEngine() })
    m.forceLiveForTest()
    m.update(0.016)
    await vi.waitFor(() => expect(window.__debugMusic).toBeTypeOf('function'))
    m.dispose()
    expect(window.__debugMusic).toBeUndefined()
  })
})
