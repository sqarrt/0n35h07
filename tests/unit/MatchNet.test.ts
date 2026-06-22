import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { RosterEntry, Snapshot } from '../../src/net/protocol'
import type { MatchRole } from '../../src/constants'
import { READY_COUNTDOWN_MS, HOST_ID, OPPONENT_ID } from '../../src/constants'

const ROSTER: RosterEntry[] = [
  { id: 0, name: 'A', color: '#4af', kind: 'human' },
  { id: 1, name: 'B', color: '#f44', kind: 'human' },
]

function makeMatch(role: MatchRole, localId: number, roster: RosterEntry[] = ROSTER) {
  const dispatch = vi.fn()
  const match = new Match({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    controls: { current: null } as React.RefObject<any>,
    keys: { current: { forward: false, back: false, left: false, right: false } } as React.MutableRefObject<any>,
    dispatch,
    role,
    netConfig: { localId, roster },
  })
  return { match, dispatch }
}

describe('Match — network mode', () => {
  it('host builds both players; serializeSnapshot returns 2 snapshots', () => {
    const { match } = makeMatch('host', 0)
    expect(match.players.map(p => p.id).sort()).toEqual([0, 1])
    const snap = match.serializeSnapshot()
    expect(snap.players.map(p => p.id).sort()).toEqual([0, 1])
  })

  it('client applies KILL: score grows, sends PLAYER_HIT for the local victim', () => {
    const { match, dispatch } = makeMatch('client', 1)
    match.applyEvent({ t: 'kill', shooter: 0, victim: 1, streak: 1, firstBlood: true, bounty: 1, resetCd: false })
    expect(match.players.find(p => p.id === 1)!.deaths).toBe(1)
    expect(match.players.find(p => p.id === 0)!.kills).toBe(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'PLAYER_HIT' })
  })

  it('client applySnapshot: both remote and local get a target (local — for reconciliation)', () => {
    const { match } = makeMatch('client', 1)
    const snap: Snapshot = {
      ackSeq: 0,
      players: [
        { id: 0, pos: [3, 1.7, 0], aimDir: [0, 0, -1], alive: true, shieldActive: false, dashing: false, windupProgress: 0, respawning: false },
        { id: 1, pos: [9, 9, 9], aimDir: [0, 0, -1], alive: true, shieldActive: false, dashing: false, windupProgress: 0, respawning: false },
      ],
    }
    match.applySnapshot(snap)
    // Remote interpolates to the target; local keeps authority for soft correction (KCC + reconcileLocal).
    expect(match.players.find(p => p.id === 0)!.hasNetTarget()).toBe(true)
    expect(match.players.find(p => p.id === 1)!.hasNetTarget()).toBe(true)
  })

  it('host with a bot opponent: the bot in the roster ends up in the snapshot', () => {
    const roster: RosterEntry[] = [
      { id: 0, name: 'You', color: '#4af', kind: 'human' },
      { id: 1, name: 'Bot', color: '#5af', kind: 'bot', difficulty: 'normal' },
    ]
    const { match } = makeMatch('host', 0, roster)
    expect(match.players.map(p => p.id).sort()).toEqual([0, 1])
    expect(match.serializeSnapshot().players).toHaveLength(2)
  })

  it('bot opponent is auto-ready: ready contains OPPONENT_ID, markReady(host) → countdown', () => {
    const roster: RosterEntry[] = [
      { id: 0, name: 'You', color: '#4af', kind: 'human' },
      { id: 1, name: 'Bot', color: '#5af', kind: 'bot', difficulty: 'normal' },
    ]
    const { match } = makeMatch('host', 0, roster)
    expect(match.phase).toBe('ready')
    expect(match.serializePhase().ready).toContain(OPPONENT_ID)
    match.markReady(HOST_ID)
    expect(match.phase).toBe('countdown')   // bot is already ready → the host's readiness is enough
  })

  it('1v1 starts in phase=ready and freezes the players', () => {
    const { match } = makeMatch('host', 0)
    expect(match.phase).toBe('ready')
    match.update(0.016)   // tickPhase → freeze
    match.human.moveIntent(new THREE.Vector3(5, 0, 0), 1)
    expect(match.human.consumeDesired().x).toBe(0)
  })

  it('both ready → countdown; once the countdown elapses → live and unfreeze', () => {
    const t0 = 1_000_000
    const spy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    const { match } = makeMatch('host', 0)
    match.markReady(0)
    match.markReady(1)
    expect(match.phase).toBe('countdown')
    spy.mockReturnValue(t0 + READY_COUNTDOWN_MS + 1)
    match.update(0.016)   // tickPhase: countdown → live
    expect(match.phase).toBe('live')
    match.human.moveIntent(new THREE.Vector3(5, 0, 0), 1)
    match.human.stepHorizontal(0.016, null)   // the velocity model turns intent into desired
    expect(match.human.consumeDesired().x).toBeGreaterThan(0)   // unfrozen
    spy.mockRestore()
  })

  it('client applyPhase applies the host phase', () => {
    const { match } = makeMatch('client', 1)
    expect(match.phase).toBe('ready')
    match.applyPhase({ phase: 'countdown', ready: [0, 1] })
    expect(match.phase).toBe('countdown')
  })

  it('handlePlayerLeft: phase ended, avatar hidden, sends SET_MATCH_RESULT disconnect/win', () => {
    const { match, dispatch } = makeMatch('host', 0)
    const opponent = match.players.find(p => p.id === 1)!
    const t0 = 5_000_000
    const spy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    match.handlePlayerLeft(1)
    expect(match.phase).toBe('ended')
    expect(opponent.bodyGroup.visible).toBe(false)
    // The outcome screen is deferred by END_FREEZE_MS — dispatched after the freeze frame.
    spy.mockReturnValue(t0 + 250)
    match.update(0.016)
    spy.mockRestore()
    const result = dispatch.mock.calls.find(c => c[0].type === 'SET_MATCH_RESULT')?.[0]
    expect(result).toBeTruthy()
    expect(result.result.reason).toBe('disconnect')
    expect(result.result.outcome).toBe('win')
    // ended → freeze
    match.update(0.016)
    match.human.moveIntent(new THREE.Vector3(5, 0, 0), 1)
    expect(match.human.consumeDesired().x).toBe(0)
  })

  it('client clears its own player justFired (the orb deflates after firing)', () => {
    const { match } = makeMatch('client', 1)
    match.human.startFiring()
    match.update(0.5)   // 0.5s > BEAM_WINDUP(0.4s) → the shot happens this frame
    expect(match.human.weaponJustFired).toBe(false)   // flag cleared (resolveCombat does not run on the client)
  })

  it('host: client input is applied to its avatar after combat starts (pushRemoteInput → update)', () => {
    const t0 = 2_000_000
    const spy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    const { match } = makeMatch('host', 0)
    match.markReady(0)
    match.markReady(1)
    spy.mockReturnValue(t0 + READY_COUNTDOWN_MS + 1)
    match.update(0.016)   // countdown elapsed → live (unfreeze)
    spy.mockRestore()
    expect(match.phase).toBe('live')

    match.pushRemoteInput(1, { seq: 1, keys: { f: false, b: false, l: false, r: false }, aimDir: [0, 0, -1], jump: false, fire: true, shield: false, dash: false })
    match.update(0.016)
    expect(match.players.find(p => p.id === 1)!.isWindingUp).toBe(true)   // fire was applied to the client's avatar
  })
})
