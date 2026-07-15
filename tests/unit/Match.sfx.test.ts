import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import type { RosterEntry } from '../../src/net/protocol'

function makeMatch(sfx?: FakeSfxEngine) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const controls = { current: { pointerSpeed: 1 } }
  const keys = { current: { forward: false, back: false, left: false, right: false, jump: false } }
  const roster: RosterEntry[] = [
    { id: 0, name: 'You', color: '#4af', kind: 'human' },
    { id: 1, name: 'Bot', color: '#5af', kind: 'bot', difficulty: 'passive' },
  ]
  return new Match({
    scene, camera, controls: controls as never, keys: keys as never, dispatch: vi.fn(),
    netConfig: { localId: 0, roster }, sfxEngine: sfx,
  })
}

describe('Match × SFX', () => {
  it('without sfxEngine update does not throw', () => {
    const m = makeMatch()
    m.forceLiveForTest()
    expect(() => m.update(0.016)).not.toThrow()
  })

  it('constructs without errors with sfxEngine', () => {
    expect(() => makeMatch(new FakeSfxEngine())).not.toThrow()
  })

  it('"go" plays once on entering live (countdown finished)', () => {
    const fake = new FakeSfxEngine()
    const m = makeMatch(fake)
    expect(fake.played('go')).toBe(0)   // not before live
    m.forceLiveForTest()
    m.update(0.016)
    m.update(0.016)
    expect(fake.played('go')).toBe(1)   // exactly once
  })
})
