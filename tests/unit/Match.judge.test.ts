import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import { EYE_HEIGHT } from '../../src/constants'
import type { RosterEntry, HitClaim, MatchEvent } from '../../src/net/protocol'

function lockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true })
}
function unlockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
}

const ROSTER: RosterEntry[] = [
  { id: 0, name: 'Me', color: '#4af', kind: 'human' },
  { id: 1, name: 'Mate', color: '#5af', kind: 'bot', difficulty: 'passive' },
  { id: 2, name: 'Foe', color: '#fa4', kind: 'bot', difficulty: 'passive' },
  { id: 3, name: 'Foe2', color: '#f4a', kind: 'bot', difficulty: 'passive' },
]

/** Пир-владелец игроков 0 и 1 (2v2: я+бот против чужих 2,3). */
function makeVictimPeer() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const match = new Match({
    scene, camera, controls: { current: { pointerSpeed: 1 } } as any,
    keys: { current: { forward: false, back: false, left: false, right: false } } as any,
    dispatch: vi.fn(), role: 'host', netConfig: { localId: 0, roster: ROSTER }, mode: '2v2',
    owners: { 0: 'ME', 1: 'ME', 2: 'X', 3: 'X' }, selfPeer: 'ME',
  })
  scene.add(match.root)
  match.forceLiveForTest()
  match.players.forEach(p => p.respawnAt(new THREE.Vector3(p.id * 3, EYE_HEIGHT, 0)))
  match.drainEvents()   // сброс стартовых событий
  return match
}

const claimOn = (victim: number, shooter: number): HitClaim =>
  ({ shooter, hitId: victim, point: [victim * 3, EYE_HEIGHT, 0], end: [victim * 3, EYE_HEIGHT, 0] })
const eventTypes = (m: Match) => m.drainEvents().map((e: MatchEvent) => e.t)

describe('Match — judgeClaim (жертва судит)', () => {
  beforeEach(lockPointer)
  afterEach(unlockPointer)

  it('жив без щита → kill-событие + локальная смерть', () => {
    const m = makeVictimPeer()
    const me = m.players.find(p => p.id === 0)!
    m.judgeClaim(claimOn(0, 2))
    expect(me.alive).toBe(false)
    expect(me.deaths).toBe(1)
    expect(eventTypes(m)).toContain('kill')
  })

  it('щит активен → block-событие, жертва жива («щит побеждает»)', () => {
    const m = makeVictimPeer()
    const me = m.players.find(p => p.id === 0)!
    me.activateShield()
    m.judgeClaim(claimOn(0, 2))
    expect(me.alive).toBe(true)
    const evs = eventTypes(m)
    expect(evs).toContain('block')
    expect(evs).not.toContain('kill')
  })

  it('призрак → игнор без событий', () => {
    const m = makeVictimPeer()
    const me = m.players.find(p => p.id === 0)!
    me.receiveHit()   // уже мёртв (призрак; счёт deaths ведёт applyKill, не receiveHit)
    m.drainEvents()
    m.judgeClaim(claimOn(0, 3))
    expect(me.deaths).toBe(0)   // суд по призраку не рождает ни смерти, ни событий
    expect(eventTypes(m)).toEqual([])
  })

  it('claim от тиммейта → игнор', () => {
    const m = makeVictimPeer()
    const me = m.players.find(p => p.id === 0)!
    m.judgeClaim(claimOn(0, 1))   // 1 — мой тиммейт
    expect(me.alive).toBe(true)
    expect(eventTypes(m)).toEqual([])
  })

  it('двойной claim в одном тике → ровно один kill', () => {
    const m = makeVictimPeer()
    m.judgeClaim(claimOn(0, 2))
    m.judgeClaim(claimOn(0, 3))
    const kills = m.players.find(p => p.id === 0)!.deaths
    expect(kills).toBe(1)
  })

  it('claim на чужого игрока → не судим (не владелец)', () => {
    const m = makeVictimPeer()
    const foe = m.players.find(p => p.id === 2)!
    m.judgeClaim(claimOn(2, 0))   // жертва 2 принадлежит X — не нам
    expect(foe.alive).toBe(true)
    expect(eventTypes(m)).toEqual([])
  })
})

describe('Match — очередь адресных claim\'ов', () => {
  beforeEach(lockPointer)
  afterEach(unlockPointer)

  it('drainClaims: попадание в чужого рождает адресный claim владельцу; в своего — судится сразу', () => {
    const m = makeVictimPeer()
    ;(m as any).queueOrJudge({ shooter: 0, hitId: 2, point: [6, EYE_HEIGHT, 0], end: [6, EYE_HEIGHT, 0] } satisfies HitClaim)
    const out = m.drainClaims()
    expect(out).toHaveLength(1)
    expect(out[0].to).toBe('X')
    expect(out[0].claim.hitId).toBe(2)
    expect(m.drainClaims()).toEqual([])   // очередь очищена

    ;(m as any).queueOrJudge({ shooter: 2, hitId: 1, point: [3, EYE_HEIGHT, 0], end: [3, EYE_HEIGHT, 0] } satisfies HitClaim)
    expect(m.players.find(p => p.id === 1)!.alive).toBe(false)   // свой бот — суд немедленно, без сети
    expect(m.drainClaims()).toEqual([])
  })
})
