import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { IAchievements } from '../../src/steam/achievements'
import type { RosterEntry } from '../../src/net/protocol'
import type { MatchRole } from '../../src/constants'

const ROSTER: RosterEntry[] = [
  { id: 0, name: 'You', color: '#4af', kind: 'human' },
  { id: 1, name: 'Bot', color: '#5af', kind: 'bot', difficulty: 'passive' },
]

// Records which local-player events reached the sink.
class FakeAchievements implements IAchievements {
  kills: Array<[number, boolean]> = []
  blocks = 0
  ends: Array<[boolean, boolean]> = []
  onKill(streak: number, firstBlood: boolean): void { this.kills.push([streak, firstBlood]) }
  onPerfectBlock(): void { this.blocks++ }
  onMatchEnd(won: boolean, flawless: boolean): void { this.ends.push([won, flawless]) }
}

function makeMatch(role: MatchRole, achievements: IAchievements) {
  return new Match({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    controls: { current: null } as React.RefObject<any>,
    keys: { current: { forward: false, back: false, left: false, right: false } } as React.MutableRefObject<any>,
    dispatch: vi.fn(),
    role,
    netConfig: { localId: 0, roster: ROSTER },   // local player is id 0
    durationMs: 600000,
    achievements,
  })
}

describe('Match → achievements routing (local player only)', () => {
  it('client: own kill drives onKill, opponent kill does not', () => {
    const ach = new FakeAchievements()
    const match = makeMatch('client', ach)
    // Our kill (shooter = localId 0)
    match.applyEvent({ t: 'kill', shooter: 0, victim: 1, streak: 2, firstBlood: false, bounty: 1, resetCd: false })
    // Opponent's kill (shooter = 1) — must NOT credit us
    match.applyEvent({ t: 'kill', shooter: 1, victim: 0, streak: 1, firstBlood: false, bounty: 1, resetCd: false })
    expect(ach.kills).toEqual([[2, false]])
  })

  it('client: own perfect block drives onPerfectBlock; a non-perfect block does not', () => {
    const ach = new FakeAchievements()
    const match = makeMatch('client', ach)
    match.applyEvent({ t: 'block', shooter: 1, victim: 0, perfect: true })
    match.applyEvent({ t: 'block', shooter: 1, victim: 0, perfect: false })
    match.applyEvent({ t: 'block', shooter: 0, victim: 1, perfect: true })   // opponent blocked us — not ours
    expect(ach.blocks).toBe(1)
  })

  it('host: a win (opponent disconnect, 0 deaths) drives onMatchEnd(true, true)', () => {
    const ach = new FakeAchievements()
    const spy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const match = makeMatch('host', ach)
    match.forceLiveForTest()
    match.handlePlayerLeft(1)   // opponent leaves → win by disconnect, we never died
    spy.mockRestore()
    expect(ach.ends).toEqual([[true, true]])
  })
})
