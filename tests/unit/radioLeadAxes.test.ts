import { describe, it, expect } from 'vitest'
import { pickAxis, type MoodTagged } from '../../src/radio/music/radio/engines/leadAxes'
import { AntiRepeatBuffer } from '../../src/radio/music/radio/AntiRepeatBuffer'
import { createRng } from '../../src/radio/music/seededRandom'

const CAT: MoodTagged[] = [
  { id: 'any1' }, { id: 'any2' },
  { id: 'darkOnly', moods: ['dark_techno'] },
  { id: 'calmOnly', moods: ['dark_ambient'] },
]
describe('pickAxis', () => {
  it('excludes mood-incompatible items', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(pickAxis(CAT, 'dark_techno', createRng('s' + i), undefined, 'x').id)
    expect(seen.has('calmOnly')).toBe(false)   // calm tag filtered out under dark_techno
    expect(seen.has('darkOnly')).toBe(true)     // dark tag allowed
  })
  it('falls back to the full catalog when <2 survive (never empty)', () => {
    const tiny: MoodTagged[] = [{ id: 'a', moods: ['x'] }, { id: 'b', moods: ['x'] }]
    const got = pickAxis(tiny, 'other', createRng('z'), undefined, 'x')  // 0 survive → fall back
    expect(['a', 'b']).toContain(got.id)
  })
  it('anti-repeat avoids the immediately-previous pick across a run', () => {
    const anti = new AntiRepeatBuffer(1)
    let prev = ''
    let repeats = 0
    for (let i = 0; i < 60; i++) {
      const id = pickAxis(CAT, 'dark_techno', createRng('r' + i), anti, 'ax').id
      if (id === prev) repeats++
      prev = id
    }
    expect(repeats).toBeLessThan(6)   // strongly de-duplicated, not necessarily zero
  })
})
