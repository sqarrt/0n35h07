import { describe, it, expect } from 'vitest'
import { BASS_COLORS } from '../../src/radio/music/radio/engines/bassColor'

describe('bassColor', () => {
  it('ids unique, ≥6, exactly the acid colour carries acid:true', () => {
    expect(new Set(BASS_COLORS.map((c) => c.id)).size).toBe(BASS_COLORS.length)
    expect(BASS_COLORS.length).toBeGreaterThanOrEqual(6)
    expect(BASS_COLORS.filter((c) => c.acid).length).toBe(1)
  })
  it('non-acid colours bring a synth source', () => {
    for (const c of BASS_COLORS) if (!c.acid) expect(typeof c.src === 'string' && c.src.length > 0).toBe(true)
  })
})
