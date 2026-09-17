import { describe, it, expect } from 'vitest'
import { FILL_SNARE_ROLLS, FILL_TOM_ROLLS, FILL_RISERS, FILL_CRASHES, FILL_RHYTHMIC_EXIT, pickFill } from '../../src/radio/music/radio/engines/fills'
import { createRng } from '../../src/radio/music/seededRandom'

describe('fills', () => {
  it('every pool has ≥3 non-empty variants', () => {
    for (const pool of [FILL_SNARE_ROLLS, FILL_TOM_ROLLS, FILL_RISERS, FILL_CRASHES, FILL_RHYTHMIC_EXIT]) {
      expect(pool.length).toBeGreaterThanOrEqual(3)
      for (const p of pool) expect(typeof p === 'string' && p.length > 0).toBe(true)
    }
  })
  it('pickFill is deterministic and in-pool', () => {
    expect(pickFill(FILL_SNARE_ROLLS, createRng('a'))).toBe(pickFill(FILL_SNARE_ROLLS, createRng('a')))
    expect(FILL_SNARE_ROLLS).toContain(pickFill(FILL_SNARE_ROLLS, createRng('z')))
  })
  it('varies across seeds', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, i) => pickFill(FILL_TOM_ROLLS, createRng('s' + i))))
    expect(seen.size).toBeGreaterThan(1)
  })
})
