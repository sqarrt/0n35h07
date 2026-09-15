import { describe, it, expect } from 'vitest'
import { rollMutations } from '../../src/radio/music/radio/MutationEngine'

// Bounds: each numeric field stays within its safe range (neutral included).
const RANGES: Record<string, [number, number]> = {
  acidenv: [-0.16, 0.10], width: [0.6, 1.5], drive: [0.6, 1.6], fm: [0.5, 1.7], env: [0.65, 1.5],
  room: [0.6, 1.7], delay: [0.7, 1.5], swing: [-0.03, 0.09], hats: [0.7, 1.4],
}

describe('rollMutations', () => {
  it('is deterministic by seed', () => {
    expect(rollMutations('abc')).toEqual(rollMutations('abc'))
  })

  it('different seeds give different mutation sets', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => JSON.stringify(rollMutations(s)))
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })

  it('numeric knobs stay in range; leadFx uses ONLY pitch-safe ops', () => {
    for (const seed of ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8']) {
      const m = rollMutations(seed) as unknown as Record<string, number | string>
      for (const [key, [lo, hi]] of Object.entries(RANGES)) {
        expect(m[key] as number, `${seed}.${key}`).toBeGreaterThanOrEqual(lo)
        expect(m[key] as number, `${seed}.${key}`).toBeLessThanOrEqual(hi)
      }
      // strip the three allowed safe ops (drop / octave-jump / ratchet) — nothing else may remain
      const stripped = (m.leadFx as string)
        .replace(/\.degradeBy\([\d.]+\)/g, '')
        .replace(/\.sometimesBy\([\d.]+, x => x\.add\(note\("<12 -12 12>"\)\)\)/g, '')
        .replace(/\.sometimesBy\([\d.]+, x => x\.ply\(2\)\)/g, '')
      expect(stripped, `${seed}.leadFx`).toBe('')
    }
  })
})
