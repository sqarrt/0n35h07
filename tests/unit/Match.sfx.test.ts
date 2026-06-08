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
    { id: 0, name: 'Вы', color: '#4af', kind: 'human' },
    { id: 1, name: 'Бот', color: '#5af', kind: 'bot', difficulty: 'passive' },
  ]
  return new Match({
    scene, camera, controls: controls as never, keys: keys as never, dispatch: vi.fn(),
    role: 'host', netConfig: { localId: 0, roster }, sfxEngine: sfx,
  })
}

describe('Match × SFX', () => {
  it('без sfxEngine update не падает', () => {
    const m = makeMatch()
    m.forceLiveForTest()
    expect(() => m.update(0.016)).not.toThrow()
  })

  it('с sfxEngine конструируется без ошибок', () => {
    expect(() => makeMatch(new FakeSfxEngine())).not.toThrow()
  })
})
