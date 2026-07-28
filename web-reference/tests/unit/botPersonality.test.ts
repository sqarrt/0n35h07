import { describe, it, expect } from 'vitest'
import { botSkill, botPersonality, offenseAt, BOT_SKILL_CEILING_RATIO } from '../../src/game/controllers/botPersonality'

describe('botSkill', () => {
  it('deterministic: one name → one skill', () => {
    expect(botSkill('RA9')).toBe(botSkill('RA9'))
  })
  it('different names → different skill (as a rule)', () => {
    expect(botSkill('RA9')).not.toBe(botSkill('T-2000'))
  })
  it('within the range [0,1]', () => {
    for (const n of ['RA9', 'T-2000', 'X', 'ZZZ999', 'a']) {
      const s = botSkill(n)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
  it('covers the full range over a sample of names', () => {
    const xs = Array.from({ length: 300 }, (_, i) => botSkill('bot' + i))
    expect(Math.min(...xs)).toBeLessThan(0.1)
    expect(Math.max(...xs)).toBeGreaterThan(0.9)
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean).toBeGreaterThan(0.4)
    expect(mean).toBeLessThan(0.6)
  })
})

describe('botPersonality', () => {
  it('deterministic: one name → one personality', () => {
    expect(botPersonality('RA9')).toEqual(botPersonality('RA9'))
  })
  it('skill matches botSkill(name)', () => {
    expect(botPersonality('RA9').skill).toBe(botSkill('RA9'))
  })
})

describe('ceiling invariant', () => {
  it('offense(1)/offense(0) ≈ BOT_SKILL_CEILING_RATIO', () => {
    const ratio = offenseAt(1) / offenseAt(0)
    expect(ratio).toBeGreaterThanOrEqual(3.8)
    expect(ratio).toBeLessThanOrEqual(4.0)
    expect(BOT_SKILL_CEILING_RATIO).toBe(3.99)
  })
  it('offense grows monotonically with skill', () => {
    expect(offenseAt(1)).toBeGreaterThan(offenseAt(0.5))
    expect(offenseAt(0.5)).toBeGreaterThan(offenseAt(0))
  })
})
