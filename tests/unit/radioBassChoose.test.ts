import { describe, it, expect } from 'vitest'
import { chooseStyle } from '../../src/radio/music/radio/trackStyle'
import { AntiRepeatBuffer } from '../../src/radio/music/radio/AntiRepeatBuffer'
import { createRng } from '../../src/radio/music/seededRandom'

const mk = (seed: string, mood = 'dark_techno') =>
  chooseStyle(createRng(seed), new AntiRepeatBuffer(3), mood, createRng(seed + ':drums'), createRng(seed + ':bassaxes'), createRng(seed + ':mute'))

describe('chooseStyle bass', () => {
  it('picks a full bass triple', () => {
    const s = mk('T')
    expect(s.bassRhythm.id.length).toBeGreaterThan(0)
    expect(s.bassMelody.id.length).toBeGreaterThan(0)
    expect(s.bassColor.id.length).toBeGreaterThan(0)
  })
  it('respects the mood guard — a HARD-only colour never appears under a calm mood', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 120; i++) ids.add(mk('m' + i, 'dark_ambient').bassColor.id)
    expect(ids.has('bitcrush')).toBe(false)   // bitcrush is HARD-tagged
    expect(ids.size).toBeGreaterThan(2)
  })
})
