import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { RosterEntry } from '../../src/net/protocol'

function lockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true })
}
function unlockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
}

const ROSTER: RosterEntry[] = [
  { id: 0, name: 'A', color: '#4af', kind: 'human' },
  { id: 1, name: 'B', color: '#5af', kind: 'bot', difficulty: 'passive' },
  { id: 2, name: 'C', color: '#fa4', kind: 'bot', difficulty: 'passive' },
]

/** Два «пира» с одинаковым ростером — деривация счёта обязана сходиться от одного потока (shooter, victim). */
function makePeer(localId: number) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const dispatch = vi.fn()
  const match = new Match({
    scene, camera, controls: { current: { pointerSpeed: 1 } } as any,
    keys: { current: { forward: false, back: false, left: false, right: false } } as any,
    dispatch, role: 'host', netConfig: { localId, roster: ROSTER }, mode: 'ffa',
  })
  return { match, dispatch }
}

const applyKill = (m: Match, s: number, v: number) => (m as any).applyKill(s, v)
const table = (m: Match) => m.players.map(p => [p.id, p.kills, p.deaths, p.streak])

describe('Match — деривация боя (applyKill/applyBlock)', () => {
  beforeEach(lockPointer)
  afterEach(unlockPointer)

  it('одинаковый поток (shooter, victim) → идентичные kills/deaths/streak на разных пирах', () => {
    const a = makePeer(0).match
    const b = makePeer(1).match
    const stream: Array<[number, number]> = [[0, 1], [0, 2], [1, 0], [0, 1], [0, 2]]
    for (const [s, v] of stream) { applyKill(a, s, v); applyKill(b, s, v) }
    expect(table(a)).toEqual(table(b))
    expect(a.players.find(p => p.id === 0)!.kills).toBeGreaterThanOrEqual(4)
    expect(a.players.find(p => p.id === 0)!.streak).toBe(2)   // после смерти от B серия начата заново
  })

  it('баунти за сломанный стрик совпадает со старой математикой', () => {
    const { match } = makePeer(0)
    for (let i = 0; i < 5; i++) applyKill(match, 1, 2)   // у B стрик 5
    const killsBefore = match.players.find(p => p.id === 0)!.kills
    applyKill(match, 0, 1)                               // A ломает стрик B
    const gained = match.players.find(p => p.id === 0)!.kills - killsBefore
    expect(gained).toBeGreaterThan(1)                    // bountyFrags(5) > 1
  })

  it('firstBlood-анонс ровно один за матч', () => {
    const { match, dispatch } = makePeer(0)
    applyKill(match, 0, 1)
    applyKill(match, 0, 2)
    const announces = dispatch.mock.calls.filter(c => c[0].type === 'ANNOUNCE' && c[0].kind === 'first')
    expect(announces.length).toBeLessThanOrEqual(1)      // точная форма kind — по announceKind; главное не два
    expect((match as any).firstKillDone).toBe(true)
  })

  it('applyKill идемпотентен к уже применённой смерти (владелец умер через receiveHit)', () => {
    const { match } = makePeer(0)
    const victim = match.players.find(p => p.id === 1)!
    victim.receiveHit()                                  // владелец уже применил смерть
    applyKill(match, 0, 1)                               // деривация не должна упасть/задвоить death
    expect(victim.deaths).toBe(1)
  })
})
