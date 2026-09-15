import { describe, it, expect } from 'vitest'
import { LEAD_RHYTHMS, rhythmOnsets, onsetCount } from '../../src/radio/music/radio/engines/leadRhythm'

describe('leadRhythm', () => {
  it('every rhythm has 4 bars and ≥1 onset', () => {
    for (const r of LEAD_RHYTHMS) {
      expect(r.bars.length).toBe(4)
      expect(onsetCount(r)).toBeGreaterThan(0)
    }
  })
  it('parses tokens into slots; xx is a pair (2 onsets)', () => {
    const r = { id: 't', bars: ['x ~ xx ~', '~ ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~'] }
    const slots = rhythmOnsets(r)
    expect(slots[0]).toEqual(['onset', 'rest', 'pair', 'rest'])
    expect(onsetCount(r)).toBe(3) // x + xx(2)
  })
  it('ids are unique', () => {
    expect(new Set(LEAD_RHYTHMS.map((r) => r.id)).size).toBe(LEAD_RHYTHMS.length)
  })
})
