import { describe, it, expect } from 'vitest'
import { LEAD_MELODIES, emitMelody, type LeadMelody } from '../../src/radio/music/radio/engines/leadMelody'
import { createRng } from '../../src/radio/music/seededRandom'

describe('leadMelody', () => {
  it('emitMelody returns exactly n elements', () => {
    for (const m of LEAD_MELODIES) {
      expect(emitMelody(m, createRng('s'), 7).length).toBe(7)
      expect(emitMelody(m, createRng('s'), 16).length).toBe(16)
    }
  })
  it('voicing stacks: dyad→2, triad→3, mono→scalar', () => {
    const mono: LeadMelody = { id: 'm', voicing: 'mono', contour: [0, 2, 4] }
    const triad: LeadMelody = { id: 't', voicing: 'triad', contour: [0] }
    expect(typeof emitMelody(mono, createRng('a'), 3)[0]).toBe('number')
    expect((emitMelody(triad, createRng('a'), 1)[0] as number[]).length).toBe(3)
  })
  it('contours loop to fill more onsets', () => {
    const m: LeadMelody = { id: 'l', voicing: 'mono', contour: [0, 3] }
    expect(emitMelody(m, createRng('a'), 4)).toEqual([0, 3, 0, 3])
  })
  it('generative strategies stay within a sane degree range', () => {
    const gens = LEAD_MELODIES.filter((m) => m.gen)
    expect(gens.length).toBeGreaterThan(0)
    for (const m of gens) {
      const els = emitMelody(m, createRng('g'), 16).map((e) => (Array.isArray(e) ? e[0] : e))
      expect(Math.max(...els)).toBeLessThanOrEqual(14)
      expect(Math.min(...els)).toBeGreaterThanOrEqual(-14)
    }
  })
  it('ids are unique', () => {
    expect(new Set(LEAD_MELODIES.map((m) => m.id)).size).toBe(LEAD_MELODIES.length)
  })
})
