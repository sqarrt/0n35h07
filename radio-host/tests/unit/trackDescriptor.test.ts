import { describe, it, expect } from 'vitest'
import { sameTrack } from '../../src/radio/trackDescriptor'
import type { TrackDescriptor } from '../../src/radio/trackDescriptor'

const base: TrackDescriptor = {
  seed: 'S', index: 3, mood: 'x', key: 'C', scaleName: 'minor', bpm: 120,
  style: { kick: 'a', bass: 'b', lead: 'c', bg: 'd', perc: 'e' },
}

describe('trackDescriptor', () => {
  it('sameTrack: equal seed+index match regardless of other fields', () => {
    expect(sameTrack(base, { ...base, mood: 'y', bpm: 99 })).toBe(true)
  })
  it('sameTrack: different index does not match', () => {
    expect(sameTrack(base, { ...base, index: 4 })).toBe(false)
  })
  it('sameTrack: different seed does not match', () => {
    expect(sameTrack(base, { ...base, seed: 'T' })).toBe(false)
  })
})
