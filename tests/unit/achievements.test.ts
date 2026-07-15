import { describe, it, expect } from 'vitest'
import { NoopAchievements, SteamAchievements } from '../../src/steam/achievements'
import type { IAchievements } from '../../src/steam/achievements'
import { STREAK_DOUBLE, STREAK_TRIPLE, STREAK_SINGULARITY } from '../../src/game/streakConfig'

describe('NoopAchievements', () => {
  it('never throws (off-Steam default)', () => {
    // Typed as the interface: that's how Match sees it (the Noop overrides drop the params, but callers pass them).
    const a: IAchievements = new NoopAchievements()
    expect(() => { a.onKill(STREAK_SINGULARITY, false); a.onPerfectBlock(); a.onMatchEnd(true, true) }).not.toThrow()
  })
})

describe('SteamAchievements — event → API name mapping', () => {
  // Inject a fake unlock fn that records the API names fired.
  const make = () => { const fired: string[] = []; return { fired, a: new SteamAchievements(n => { fired.push(n) }) } }

  it('first blood → CATALYST', () => {
    const { fired, a } = make()
    a.onKill(1, true)
    expect(fired).toEqual(['ACH_CATALYST'])
  })

  it('streak thresholds → DOUBLE / TRIPLE / SINGULARITY (exact tier word)', () => {
    const { fired, a } = make()
    a.onKill(STREAK_DOUBLE, false)
    a.onKill(STREAK_TRIPLE, false)
    a.onKill(STREAK_SINGULARITY, false)
    expect(fired).toEqual(['ACH_DOUBLE_KILL', 'ACH_TRIPLE_KILL', 'ACH_SINGULARITY'])
  })

  it('a plain kill below any threshold unlocks nothing', () => {
    const { fired, a } = make()
    a.onKill(1, false)   // streak 1, not first blood
    expect(fired).toEqual([])
  })

  it('perfect block → DEFLECTOR', () => {
    const { fired, a } = make()
    a.onPerfectBlock()
    expect(fired).toEqual(['ACH_DEFLECTOR'])
  })

  it('win → FIRST_WIN; flawless win also → UNTOUCHABLE', () => {
    const { fired, a } = make()
    a.onMatchEnd(true, false)
    expect(fired).toEqual(['ACH_FIRST_WIN'])
    a.onMatchEnd(true, true)
    expect(fired).toEqual(['ACH_FIRST_WIN', 'ACH_UNTOUCHABLE'])
  })

  it('a loss unlocks nothing', () => {
    const { fired, a } = make()
    a.onMatchEnd(false, false)
    expect(fired).toEqual([])
  })

  it('de-dups repeat triggers within a session', () => {
    const { fired, a } = make()
    a.onKill(1, true)
    a.onKill(1, true)   // CATALYST again next match — must not re-fire
    expect(fired).toEqual(['ACH_CATALYST'])
  })
})
