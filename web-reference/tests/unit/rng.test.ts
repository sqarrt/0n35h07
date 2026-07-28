import { describe, it, expect } from 'vitest'
import { hashSeed, mulberry32 } from '../../src/game/audio/rng'

describe('hashSeed', () => {
  it('deterministic: same string → same seed', () => {
    expect(hashSeed('AB12')).toBe(hashSeed('AB12'))
  })
  it('different strings → different seeds (usually)', () => {
    expect(hashSeed('AB12')).not.toBe(hashSeed('AB13'))
  })
  it('returns a uint32', () => {
    const h = hashSeed('XYZ9')
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(0xFFFFFFFF)
  })
})

describe('mulberry32', () => {
  it('deterministic: same seed → same sequence', () => {
    const a = mulberry32(123), b = mulberry32(123)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('values in [0,1)', () => {
    const r = mulberry32(999)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
