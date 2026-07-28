import { describe, it, expect } from 'vitest'
import { generateModelName, MODEL_NAME_RE } from '../../src/names'
import { NAME_MAX } from '../../src/settings'

describe('generateModelName', () => {
  it('always produces a name in model format and within NAME_MAX', () => {
    for (let i = 0; i < 500; i++) {
      const name = generateModelName()
      expect(name).toMatch(MODEL_NAME_RE)
      expect(name.length).toBeGreaterThan(0)
      expect(name.length).toBeLessThanOrEqual(NAME_MAX)
    }
  })

  it('provides variety (does not get stuck on one name)', () => {
    const names = new Set(Array.from({ length: 100 }, () => generateModelName()))
    expect(names.size).toBeGreaterThan(10)
  })

  it('covers both forms — joined (RTX4080) and hyphenated (T-2000)', () => {
    const names = Array.from({ length: 500 }, () => generateModelName())
    expect(names.some(n => n.includes('-'))).toBe(true)
    expect(names.some(n => !n.includes('-'))).toBe(true)
  })
})
