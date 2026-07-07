// Протокол смерти в полном меше (спека §5-6, покрытие §10): три ПОЛНЫХ стека Match+NetSession на
// LoopbackHub — сходимость счёта, гонки двойного килла, «щит побеждает», потерянный claim, уход пира,
// фазовый ритуал со штампом создателя. Боевые e2e не нужны — вся сетевая боёвка закреплена здесь.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import { NetSession } from '../../src/net/NetSession'
import { createLoopbackHub, LoopbackNet } from '../../src/net/LoopbackNet'
import type { RosterEntry } from '../../src/net/protocol'
import { EYE_HEIGHT, NET_PREDICT_KILL_MS } from '../../src/constants'
import type { GameMode } from '../../src/game/modes'

function lockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true })
}
function unlockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
}

// Ростер: 0 — человек пира A (создатель), 1 — человек пира B, 2 — человек пира C, 3 — бот пира A (2v2: команды {0,1} vs {2,3}).
const ROSTER: RosterEntry[] = [
  { id: 0, name: 'A0', color: '#4af', kind: 'human' },
  { id: 1, name: 'B1', color: '#fa4', kind: 'human' },
  { id: 2, name: 'C2', color: '#4fa', kind: 'human' },
  { id: 3, name: 'ABot', color: '#f4a', kind: 'bot', difficulty: 'passive' },
]
const OWNERS = { 0: 'A', 1: 'B', 2: 'C', 3: 'A' }

interface Peer { match: Match; session: NetSession; net: LoopbackNet; scene: THREE.Scene }

function makeMesh(mode: GameMode = 'ffa'): Record<'A' | 'B' | 'C', Peer> {
  const nets = createLoopbackHub(['A', 'B', 'C'])
  const peers = {} as Record<'A' | 'B' | 'C', Peer>
  const localOf = { A: 0, B: 1, C: 2 }
  ;(['A', 'B', 'C'] as const).forEach((id, i) => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
    const match = new Match({
      scene, camera, controls: { current: { pointerSpeed: 1 } } as any,
      keys: { current: { forward: false, back: false, left: false, right: false } } as any,
      dispatch: vi.fn(), role: 'peer', netConfig: { localId: localOf[id], roster: ROSTER }, mode,
      owners: OWNERS, selfPeer: id,
    })
    scene.add(match.root)
    const session = new NetSession(nets[i], match)
    peers[id] = { match, session, net: nets[i], scene }
  })
  return peers
}

/** Раскачать сеть: у каждого пира слить исходящее (события/claim'ы/снапшот) — синхронная доставка hub'а. */
function flush(peers: Record<string, Peer>, rounds = 3) {
  for (let r = 0; r < rounds; r++) {
    for (const p of Object.values(peers)) p.session.afterUpdate(1e9 + r * 1000)   // всегда за порогом троттла
  }
}

function live(peers: Record<string, Peer>) {
  for (const p of Object.values(peers)) p.match.forceLiveForTest()
  for (const p of Object.values(peers)) p.match.players.forEach(pl => pl.respawnAt(new THREE.Vector3(pl.id * 4, EYE_HEIGHT, 0)))
  for (const p of Object.values(peers)) { p.match.drainEvents(); p.match.drainClaims() }
}

const table = (m: Match) => m.players.map(p => [p.id, p.kills, p.deaths]).sort((a, b) => a[0] - b[0])
const player = (p: Peer, id: number) => p.match.players.find(x => x.id === id)!
const claimOn = (shooter: number, victim: number) => ({ shooter, hitId: victim, point: [victim * 4, EYE_HEIGHT, 0] as [number, number, number], end: [victim * 4, EYE_HEIGHT, 0] as [number, number, number] })

describe('mesh — протокол смерти (3 полных стека на LoopbackHub)', () => {
  beforeEach(lockPointer)
  afterEach(() => { unlockPointer(); vi.restoreAllMocks() })

  it('сходимость: килл через сеть даёт идентичные таблицы у всех трёх пиров', () => {
    const peers = makeMesh()
    live(peers)
    // B стреляет в жертву 2 (владелец C): claim B→C, C судит, kill разлетается всем.
    peers.B.match.queueOrJudge(claimOn(1, 2))
    flush(peers)
    expect(player(peers.C, 2).alive).toBe(false)
    expect(table(peers.A.match)).toEqual(table(peers.B.match))
    expect(table(peers.B.match)).toEqual(table(peers.C.match))
    expect(player(peers.A, 1).kills).toBe(1)
    expect(player(peers.A, 2).deaths).toBe(1)
  })

  it('двойной килл: два claim\'а в жертву C в одном флаше → ровно один kill, счёт сходится', () => {
    const peers = makeMesh()
    live(peers)
    peers.A.match.queueOrJudge(claimOn(0, 2))
    peers.B.match.queueOrJudge(claimOn(1, 2))
    flush(peers)
    expect(player(peers.C, 2).deaths).toBe(1)                 // умер один раз
    const killsA = player(peers.C, 0).kills + player(peers.C, 1).kills
    expect(killsA).toBe(1)                                    // фраг достался ровно одному стрелку
    expect(table(peers.A.match)).toEqual(table(peers.C.match))
    expect(table(peers.B.match)).toEqual(table(peers.C.match))
  })

  it('щит побеждает: у жертвы локально активен щит → block у всех, предсказание стрелка откатилось', () => {
    const peers = makeMesh()
    live(peers)
    player(peers.C, 2).activateShield()                       // реальное состояние владельца
    // Стрелок B предсказывает килл локально (как это делает resolveCombat для чужой жертвы).
    ;(peers.B.match as any).predictOpponentDeath(2)
    expect(player(peers.B, 2).alive).toBe(false)              // предсказан труп
    peers.B.match.queueOrJudge(claimOn(1, 2))
    flush(peers)
    expect(player(peers.C, 2).alive).toBe(true)               // владелец жив — щит победил
    expect(player(peers.B, 2).alive).toBe(true)               // block отменил предсказание у стрелка
    expect(player(peers.A, 2).deaths).toBe(0)
    expect(player(peers.A, 1).kills).toBe(0)
  })

  it('потерянный claim: вердикт не пришёл → grace-таймаут + снапшот владельца ревайвят жертву у стрелка', () => {
    let timeOffset = 0
    const realNow = Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => realNow.call(Date) + timeOffset)
    const peers = makeMesh()
    live(peers)
    ;(peers.B.match as any).predictOpponentDeath(2)           // выстрел «ушёл», но claim потерялся (не шлём)
    expect(player(peers.B, 2).alive).toBe(false)
    timeOffset += NET_PREDICT_KILL_MS + 50
    peers.C.session.afterUpdate(realNow.call(Date) + timeOffset)   // владелец шлёт очередной снапшот «жив»
    expect(player(peers.B, 2).alive).toBe(true)
    expect(player(peers.B, 2).deaths).toBe(0)
  })

  it('2v2: claim от тиммейта игнорируется владельцем', () => {
    const peers = makeMesh('2v2')                             // команды {0,1} и {2,3}
    live(peers)
    peers.B.match.queueOrJudge(claimOn(1, 0))                 // B стреляет в тиммейта 0 (владелец A)
    flush(peers)
    expect(player(peers.A, 0).alive).toBe(true)
    expect(player(peers.C, 0).deaths).toBe(0)
  })

  it('уход пира: его игроки (и бот!) уходят у остальных; матч жив при ≥2 командах', () => {
    const peers = makeMesh()                                  // ffa: 4 команды
    live(peers)
    peers.B.net.triggerLeave('A')                             // у пира B исчез пир A (владелец 0 и бота 3)
    expect(player(peers.B, 0).bodyGroup.visible).toBe(false)
    expect(player(peers.B, 3).bodyGroup.visible).toBe(false)  // бот ушёл вместе с владельцем
    expect(peers.B.match.phase).not.toBe('ended')             // остались 1 и 2 — две команды
    peers.B.net.triggerLeave('C')                             // ушёл и C → осталась одна команда
    expect(peers.B.match.phase).toBe('ended')
  })

  it('фазовый ритуал: ready каждого доходит до всех, countdown стартует по штампу создателя', () => {
    const peers = makeMesh()
    // Боты (3) авто-ready у всех детерминированно; люди объявляют свои.
    peers.B.match.markReady(1)
    peers.C.match.markReady(2)
    flush(peers)
    expect(peers.A.match.phase).toBe('ready')                 // создатель ещё не ready — штампа нет
    peers.A.match.markReady(0)
    expect(peers.A.match.phase).toBe('countdown')             // полный комплект у создателя → штамп
    expect(peers.B.match.phase).toBe('ready')                 // до рассылки фазы B ещё в ready
    flush(peers)
    expect(peers.B.match.phase).toBe('countdown')             // штамп доехал
    expect(peers.C.match.phase).toBe('countdown')
  })
})
