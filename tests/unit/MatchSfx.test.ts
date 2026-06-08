import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { MatchSfx } from '../../src/game/audio/sfx/MatchSfx'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'

const pos = () => new THREE.Vector3(1, 2, 3)

describe('MatchSfx.combat', () => {
  it('fired→beam_fire, block→block, kill→death, respawn→respawn', () => {
    const fake = new FakeSfxEngine()
    const sfx = new MatchSfx(fake)
    sfx.combat({ t: 'fired', id: 1, end: [0, 0, 0], hitPoint: null, hit: null }, () => pos())
    sfx.combat({ t: 'block', shooter: 0, victim: 1 }, () => pos())
    sfx.combat({ t: 'kill', shooter: 0, victim: 1 }, () => pos())
    sfx.combat({ t: 'respawn', id: 1, pos: [0, 1, 0] }, () => pos())
    expect(fake.played('beam_fire')).toBe(1)
    expect(fake.played('block')).toBe(1)
    expect(fake.played('death')).toBe(1)
    expect(fake.played('respawn')).toBe(1)
  })

  it('игнорирует не-боевые события (scores/time)', () => {
    const fake = new FakeSfxEngine()
    new MatchSfx(fake).combat({ t: 'time', remainingMs: 1000 }, () => pos())
    expect(fake.calls.length).toBe(0)
  })
})
