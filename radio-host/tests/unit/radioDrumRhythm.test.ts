import { describe, it, expect } from 'vitest'
import { DRUM_RHYTHMS } from '../../src/radio/music/radio/engines/drumRhythm'

describe('drumRhythm', () => {
  it('ids unique, ≥6 grooves', () => {
    expect(new Set(DRUM_RHYTHMS.map((r) => r.id)).size).toBe(DRUM_RHYTHMS.length)
    expect(DRUM_RHYTHMS.length).toBeGreaterThanOrEqual(6)
  })
  it('every groove defines the four core layers + swing', () => {
    for (const r of DRUM_RHYTHMS) {
      for (const p of [r.kick, r.hat, r.snare, r.clap]) expect(typeof p === 'string' && p.length > 0).toBe(true)
      expect(typeof r.swing).toBe('number')
    }
  })
})
