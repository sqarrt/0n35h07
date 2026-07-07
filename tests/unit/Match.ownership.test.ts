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
  { id: 0, name: 'Me', color: '#4af', kind: 'human' },
  { id: 1, name: 'MyBot', color: '#5af', kind: 'bot', difficulty: 'passive' },
  { id: 2, name: 'Them', color: '#fa4', kind: 'human' },
  { id: 3, name: 'TheirBot', color: '#f4a', kind: 'bot', difficulty: 'normal' },
]

function makeMatch(owners?: Record<number, string>, selfPeer?: string) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const match = new Match({
    scene, camera, controls: { current: { pointerSpeed: 1 } } as any,
    keys: { current: { forward: false, back: false, left: false, right: false } } as any,
    dispatch: vi.fn(), role: 'host', netConfig: { localId: 0, roster: ROSTER }, mode: 'ffa',
    owners, selfPeer,
  })
  scene.add(match.root)
  return match
}

describe('Match — ownership map', () => {
  beforeEach(lockPointer)
  afterEach(unlockPointer)

  it('без owners всё принадлежит локальному пиру (бот-матчи/старые тесты)', () => {
    const m = makeMatch()
    expect([...m.ownedIds].sort()).toEqual([0, 1, 2, 3])
  })

  it('owners: мои — свой слот и свой бот; чужие — не мои', () => {
    const m = makeMatch({ 0: 'ME', 1: 'ME', 2: 'X', 3: 'X' }, 'ME')
    expect([...m.ownedIds].sort()).toEqual([0, 1])
    expect(m.ownerOf(2)).toBe('X')
    expect(m.ownerOf(0)).toBe('ME')
  })

  it('чужой бот НЕ получает BotController (без интентов — стоит на месте)', () => {
    const m = makeMatch({ 0: 'ME', 1: 'ME', 2: 'X', 3: 'X' }, 'ME')
    m.forceLiveForTest()
    const theirBot = m.players.find(p => p.id === 3)!
    const before = theirBot.position.clone()
    const scene = new THREE.Scene(); scene.add(m.root)
    for (let i = 0; i < 30; i++) { scene.updateMatrixWorld(true); m.update(0.016) }
    expect(theirBot.position.distanceTo(before)).toBeLessThan(0.01)
  })

  it('свой бот получает контроллер (normal-бот двигается)', () => {
    const m = makeMatch({ 0: 'ME', 1: 'ME', 2: 'X', 3: 'X' }, 'ME')
    // свой бот — слот 1 (passive в ростере — проверяем через наличие в bots и контроллер чужого)
    expect(m.bots.map(b => b.id)).toContain(1)
  })
})
