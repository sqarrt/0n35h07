import { describe, it, expect } from 'vitest'
import { BASS_MELODIES } from '../../src/radio/music/radio/engines/bassMelody'

describe('bassMelody', () => {
  it('ids unique, ≥6, every melody has ≥1 offset within ±12 semitones', () => {
    expect(new Set(BASS_MELODIES.map((m) => m.id)).size).toBe(BASS_MELODIES.length)
    expect(BASS_MELODIES.length).toBeGreaterThanOrEqual(6)
    for (const m of BASS_MELODIES) {
      expect(m.offs.length).toBeGreaterThan(0)
      for (const o of m.offs) { expect(o).toBeLessThanOrEqual(12); expect(o).toBeGreaterThanOrEqual(-12) }
    }
  })
})
