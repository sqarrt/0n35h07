import { describe, it, expect } from 'vitest'
import { streakTier, announceKind, tierWord, announceSfx } from '../../src/game/streak'

describe('streak · тир подсветки от числа серии', () => {
  it('0–1 → нет тира', () => { expect(streakTier(0)).toBeNull(); expect(streakTier(1)).toBeNull() })
  it('2 → double, 3 и 4 → triple, 5+ → singularity', () => {
    expect(streakTier(2)).toBe('double')
    expect(streakTier(3)).toBe('triple')
    expect(streakTier(4)).toBe('triple')
    expect(streakTier(5)).toBe('singularity')
    expect(streakTier(9)).toBe('singularity')
  })
})

describe('streak · баннер (рубеж/первая кровь)', () => {
  it('firstBlood → catalyst (даже при серии 1)', () => { expect(announceKind(1, true)).toBe('catalyst') })
  it('точные пороги 2/3/5 → double/triple/singularity', () => {
    expect(announceKind(2, false)).toBe('double')
    expect(announceKind(3, false)).toBe('triple')
    expect(announceKind(5, false)).toBe('singularity')
  })
  it('не-пороги (1,4,6) без firstBlood → null', () => {
    expect(announceKind(1, false)).toBeNull()
    expect(announceKind(4, false)).toBeNull()
    expect(announceKind(6, false)).toBeNull()
  })
})

describe('streak · слова и звуки', () => {
  it('tierWord', () => {
    expect(tierWord('catalyst')).toBe('CATALYST')
    expect(tierWord('double')).toBe('DOUBLE KILL')
    expect(tierWord('triple')).toBe('TRIPLE KILL')
    expect(tierWord('singularity')).toBe('SINGULARITY')
  })
  it('announceSfx → id файла без .opus', () => {
    expect(announceSfx('catalyst')).toBe('catalyst')
    expect(announceSfx('double')).toBe('double_kill')
    expect(announceSfx('triple')).toBe('triple_kill')
    expect(announceSfx('singularity')).toBe('singularity')
  })
})
