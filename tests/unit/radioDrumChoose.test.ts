import { describe, it, expect } from 'vitest'
import { chooseStyle } from '../../src/radio/music/radio/trackStyle'
import { AntiRepeatBuffer } from '../../src/radio/music/radio/AntiRepeatBuffer'
import { createRng } from '../../src/radio/music/seededRandom'

const mk = (seed: string, mood = 'dark_techno') =>
  chooseStyle(createRng(seed), new AntiRepeatBuffer(3), mood, createRng(seed + ':drums'), createRng(seed + ':bassaxes'))

describe('chooseStyle drums', () => {
  it('picks a full drum triple', () => {
    const s = mk('T')
    expect(s.drumRhythm.id.length).toBeGreaterThan(0)
    expect(s.drumKit.id.length).toBeGreaterThan(0)
    expect(s.drumColor.id.length).toBeGreaterThan(0)
  })
  it('is deterministic per seed', () => {
    expect(mk('T').drumColor.id).toBe(mk('T').drumColor.id)
  })
  it('respects the mood guard — a HARD-only colour never appears under a calm mood', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 120; i++) ids.add(mk('m' + i, 'dark_ambient').drumColor.id)
    expect(ids.has('crunchy')).toBe(false)   // crunchy is HARD-tagged
    expect(ids.size).toBeGreaterThan(2)
  })
})
