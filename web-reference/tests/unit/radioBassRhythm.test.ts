import { describe, it, expect } from 'vitest'
import { BASS_RHYTHMS, bassOnsets } from '../../src/radio/music/radio/engines/bassRhythm'

describe('bassRhythm', () => {
  it('ids unique, ≥6, every mask has 16 tokens and ≥1 onset (BASS LAW)', () => {
    expect(new Set(BASS_RHYTHMS.map((r) => r.id)).size).toBe(BASS_RHYTHMS.length)
    expect(BASS_RHYTHMS.length).toBeGreaterThanOrEqual(6)
    for (const r of BASS_RHYTHMS) {
      expect(r.mask.trim().split(/\s+/).length).toBe(16)
      expect(bassOnsets(r).some(Boolean)).toBe(true)
    }
  })
  it('accent patterns (when present) have 16 tokens', () => {
    for (const r of BASS_RHYTHMS) if (r.accent) expect(r.accent.trim().split(/\s+/).length).toBe(16)
  })
})
