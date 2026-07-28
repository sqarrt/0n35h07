import { describe, it, expect } from 'vitest'
import { overheatMods, bountyFrags, breakResetsCooldowns, streakDots } from '../../src/game/overheat'

describe('overheat · modifiers by streak', () => {
  it('0–1 → neutral, no seeThrough', () => {
    for (const s of [0, 1]) {
      expect(overheatMods(s)).toEqual({ speed: 1, beamCd: 1, shieldCd: 1, seeThrough: false })
    }
  })
  it('2 (DOUBLE) → 1.10 / 1.15 / 1.15', () => {
    expect(overheatMods(2)).toEqual({ speed: 1.1, beamCd: 1.15, shieldCd: 1.15, seeThrough: false })
  })
  it('3 and 4 (TRIPLE) → 1.20 / 1.30 / 1.30', () => {
    expect(overheatMods(3)).toEqual({ speed: 1.2, beamCd: 1.3, shieldCd: 1.3, seeThrough: false })
    expect(overheatMods(4)).toEqual({ speed: 1.2, beamCd: 1.3, shieldCd: 1.3, seeThrough: false })
  })
  it('5+ (SINGULARITY) → 1.30 / 1.50 / 1.50 + seeThrough', () => {
    expect(overheatMods(5)).toEqual({ speed: 1.3, beamCd: 1.5, shieldCd: 1.5, seeThrough: true })
    expect(overheatMods(9)).toEqual({ speed: 1.3, beamCd: 1.5, shieldCd: 1.5, seeThrough: true })
  })
})

describe('overheat · bounty for ending a streak', () => {
  it('DOUBLE (2) ended → 1 frag, no reset', () => {
    expect(bountyFrags(2)).toBe(1)
    expect(breakResetsCooldowns(2)).toBe(false)
  })
  it('TRIPLE (3–4) ended → 2 frags + reset', () => {
    expect(bountyFrags(3)).toBe(2); expect(bountyFrags(4)).toBe(2)
    expect(breakResetsCooldowns(3)).toBe(true)
  })
  it('SINGULARITY (5+) ended → 3 frags + reset', () => {
    expect(bountyFrags(5)).toBe(3); expect(bountyFrags(9)).toBe(3)
    expect(breakResetsCooldowns(5)).toBe(true)
  })
  it('victim without a streak (0–1) → 1 frag, no reset', () => {
    expect(bountyFrags(0)).toBe(1); expect(bountyFrags(1)).toBe(1)
    expect(breakResetsCooldowns(1)).toBe(false)
  })
})

describe('overheat · streak dots (cap 10)', () => {
  it('0 → 0, 7 → 7, 10 → 10, 15 → 10', () => {
    expect(streakDots(0)).toBe(0)
    expect(streakDots(7)).toBe(7)
    expect(streakDots(10)).toBe(10)
    expect(streakDots(15)).toBe(10)
  })
})
