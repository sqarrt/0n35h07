import { describe, it, expect } from 'vitest'
import { disguiseCells } from '../../src/radio/music/radio/seqDisguise'
import { createRng } from '../../src/radio/music/seededRandom'

describe('disguiseCells', () => {
  it('is a no-op for single-token / repeated patterns', () => {
    expect(disguiseCells('0*16', createRng('s'))).toBe('0*16')
  })

  it('preserves the token multiset and length (same notes + durations, only reordered)', () => {
    const p = '0 _ _ 6 _ _ 0 _ 6 _ 5 _ 4 _ 0 _'
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const out = disguiseCells(p, createRng(seed))
      expect(out.split(' ').sort()).toEqual(p.split(' ').sort())
      expect(out.split(' ')).toHaveLength(16)
    }
  })

  it('keeps every hold attached to its note (no leading "_")', () => {
    const out = disguiseCells('0 _ _ 6 _ 5 _ _ 4 _ 0 _ 6 _ 0 _', createRng('z'))
    expect(out.startsWith('_')).toBe(false)
  })

  it('is deterministic by seed', () => {
    const p = '0 0 0 6 0 0 0 0 0 0 6 0 5 0 0 0'
    expect(disguiseCells(p, createRng('x'))).toBe(disguiseCells(p, createRng('x')))
  })
})
