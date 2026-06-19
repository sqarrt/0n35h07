import { describe, it, expect } from 'vitest'
import { seededRng } from '../../src/game/util/seededRng'

describe('seededRng', () => {
  it('детерминирован: один seed → одинаковая последовательность', () => {
    const a = seededRng('RA9'); const b = seededRng('RA9')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('разные seed → разные последовательности', () => {
    const a = seededRng('RA9'); const b = seededRng('T-2000')
    expect(a()).not.toBe(b())
  })

  it('значения в диапазоне [0,1)', () => {
    const r = seededRng('X')
    for (let i = 0; i < 100; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
})
