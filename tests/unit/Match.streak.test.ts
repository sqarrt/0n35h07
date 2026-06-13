import { describe, it, expect } from 'vitest'
import { streakTier, announceKind, tierWord, announceSfx } from '../../src/game/streak'
import type { MatchEvent } from '../../src/net/protocol'

// Match тянет three/rapier и не конструируется в jsdom → интеграцию host→client (синхрон серии, баннер,
// звук) проверяет e2e (tests/killstreak.spec.ts). Здесь держим инварианты анонса на чистой логике.

describe('Match.streak · инварианты анонса (логика)', () => {
  it('первый фраг → catalyst + звук catalyst, тира подсветки нет', () => {
    const k = announceKind(1, true)
    expect(k).toBe('catalyst')
    expect(announceSfx(k!)).toBe('catalyst')
    expect(streakTier(1)).toBeNull()
  })
  it('второй подряд → double-баннер + подсветка double', () => {
    expect(announceKind(2, false)).toBe('double')
    expect(streakTier(2)).toBe('double')
    expect(tierWord('double')).toBe('DOUBLE KILL')
  })
  it('после смерти серия сброшена → следующий фраг снова без баннера (серия 1)', () => {
    expect(announceKind(1, false)).toBeNull()
    expect(streakTier(1)).toBeNull()
  })
})

describe('Match.streak · поле события kill переносит серию', () => {
  it('событие kill содержит streak и firstBlood', () => {
    const e: MatchEvent = { t: 'kill', shooter: 0, victim: 1, streak: 3, firstBlood: false }
    expect(e.t === 'kill' && e.streak).toBe(3)
    expect(e.t === 'kill' && e.firstBlood).toBe(false)
  })
})
