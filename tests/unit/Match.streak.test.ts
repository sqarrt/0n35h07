import { describe, it, expect } from 'vitest'
import { streakTier, announceKind, tierWord, announceSfx } from '../../src/game/streak'
import type { MatchEvent } from '../../src/net/protocol'

// Match pulls in three/rapier and does not construct in jsdom → the host→client integration (streak sync,
// banner, sound) is covered by e2e (tests/killstreak.spec.ts). Here we keep the announce invariants on pure logic.

describe('Match.streak · announce invariants (logic)', () => {
  it('first frag → catalyst + catalyst sound, no highlight tier', () => {
    const k = announceKind(1, true)
    expect(k).toBe('catalyst')
    expect(announceSfx(k!)).toBe('catalyst')
    expect(streakTier(1)).toBeNull()
  })
  it('second in a row → double banner + double highlight', () => {
    expect(announceKind(2, false)).toBe('double')
    expect(streakTier(2)).toBe('double')
    expect(tierWord('double')).toBe('DOUBLE KILL')
  })
  it('after death the streak resets → the next frag has no banner again (streak 1)', () => {
    expect(announceKind(1, false)).toBeNull()
    expect(streakTier(1)).toBeNull()
  })
})

describe('Match.streak · kill event field carries the streak', () => {
  it('kill event contains streak and firstBlood', () => {
    const e: MatchEvent = { t: 'kill', shooter: 0, victim: 1, streak: 3, firstBlood: false, bounty: 2, resetCd: true }
    expect(e.t === 'kill' && e.streak).toBe(3)
    expect(e.t === 'kill' && e.firstBlood).toBe(false)
  })
})
