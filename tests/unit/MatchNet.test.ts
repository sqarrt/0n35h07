import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { PeerInfo, Snapshot } from '../../src/net/protocol'
import type { MatchRole } from '../../src/constants'

const PEERS: PeerInfo[] = [
  { id: 0, name: 'A', color: '#4af' },
  { id: 1, name: 'B', color: '#f44' },
]

function makeMatch(role: MatchRole, localId: number) {
  const dispatch = vi.fn()
  const match = new Match({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    controls: { current: null } as React.RefObject<any>,
    keys: { current: { forward: false, back: false, left: false, right: false } } as React.MutableRefObject<any>,
    dispatch,
    botDifficulties: [],
    role,
    netConfig: { localId, peers: PEERS },
  })
  return { match, dispatch }
}

describe('Match — сетевой режим', () => {
  it('host строит обоих игроков; serializeSnapshot отдаёт 2 снимка', () => {
    const { match } = makeMatch('host', 0)
    expect(match.players.map(p => p.id).sort()).toEqual([0, 1])
    const snap = match.serializeSnapshot()
    expect(snap.players.map(p => p.id).sort()).toEqual([0, 1])
  })

  it('client применяет KILL: счёт растёт, шлёт KILL и PLAYER_HIT для локальной жертвы', () => {
    const { match, dispatch } = makeMatch('client', 1)
    match.applyEvent({ t: 'kill', shooter: 0, victim: 1 })
    expect(match.players.find(p => p.id === 1)!.deaths).toBe(1)
    expect(match.players.find(p => p.id === 0)!.kills).toBe(1)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'KILL' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'PLAYER_HIT' })
  })

  it('client applySnapshot ставит цель удалённому, своего не трогает', () => {
    const { match } = makeMatch('client', 1)
    const snap: Snapshot = {
      ackSeq: 0,
      players: [
        { id: 0, pos: [3, 1.7, 0], aimDir: [0, 0, -1], alive: true, shieldActive: false, dashing: false, windupProgress: 0 },
        { id: 1, pos: [9, 9, 9], aimDir: [0, 0, -1], alive: true, shieldActive: false, dashing: false, windupProgress: 0 },
      ],
    }
    match.applySnapshot(snap)
    expect(match.players.find(p => p.id === 0)!.hasNetTarget()).toBe(true)   // удалённый
    expect(match.players.find(p => p.id === 1)!.hasNetTarget()).toBe(false)  // свой — предсказывается
  })

  it('host: ввод клиента двигает его аватар (pushRemoteInput → update)', () => {
    const { match } = makeMatch('host', 0)
    match.pushRemoteInput(1, { seq: 1, keys: { f: false, b: false, l: false, r: false }, aimDir: [0, 0, -1], jump: false, fire: true, shield: false, dash: false })
    match.update(0.016)
    expect(match.players.find(p => p.id === 1)!.isWindingUp).toBe(true)   // fire применился к аватару клиента
  })
})
