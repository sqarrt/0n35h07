import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import { EYE_HEIGHT, DEFAULT_MAP_ID } from '../../src/constants'
import type { RosterEntry, Vec3 } from '../../src/net/protocol'
import type { GameMode } from '../../src/game/modes'
import { MAPS } from '../../src/game/maps'

function lockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true })
}
function unlockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
}

/** 4-player host match under a mode preset (me id 0 + passive bots); ready ritual skipped. */
function makeTeamsMatch(mode: GameMode, ffaSpawns?: Vec3[], rosterOverride?: RosterEntry[]) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const roster: RosterEntry[] = rosterOverride ?? [
    { id: 0, name: 'You', color: '#4af', kind: 'human' },
    { id: 1, name: 'Mate', color: '#5af', kind: 'bot', difficulty: 'passive' },
    { id: 2, name: 'Foe1', color: '#fa4', kind: 'bot', difficulty: 'passive' },
    { id: 3, name: 'Foe2', color: '#f4a', kind: 'bot', difficulty: 'passive' },
  ]
  const match = new Match({
    scene, camera, controls: { current: { pointerSpeed: 1 } } as any,
    keys: { current: { forward: false, back: false, left: false, right: false } } as any,
    dispatch: vi.fn(), role: 'host', netConfig: { localId: 0, roster }, mode, ffaSpawns,
  })
  scene.add(match.root)
  match.installDebug(camera)
  match.forceLiveForTest()
  return { match, scene, camera }
}

function step(match: Match, scene: THREE.Scene, n = 45, dt = 0.016) {
  for (let i = 0; i < n; i++) { scene.updateMatrixWorld(true); match.update(dt) }
}

const at = (x: number, z: number) => new THREE.Vector3(x, EYE_HEIGHT, z)

describe('Match — teams from the mode preset', () => {
  beforeEach(lockPointer)
  afterEach(unlockPointer)

  it('2v2: у игроков команды по пресету (0,1 → 0; 2,3 → 1)', () => {
    const { match } = makeTeamsMatch('2v2')
    expect(match.players.map(p => [p.id, p.team]).sort()).toEqual([[0, 0], [1, 0], [2, 1], [3, 1]])
  })

  it('2v2: луч гаснет на тиммейте — ни урона ему, ни киллов, враг позади не задет', () => {
    const { match, scene, camera } = makeTeamsMatch('2v2')
    const [mate, foe1, foe2] = match.bots           // ids 1, 2, 3
    match.human.respawnAt(at(0, 0))
    mate.respawnAt(at(0, -5))                       // teammate right in front
    foe1.respawnAt(at(0, -8))                       // enemy BEHIND the teammate on the same line
    foe2.respawnAt(at(15, 15))                      // far away
    camera.position.set(0, EYE_HEIGHT, 0)
    camera.lookAt(0, EYE_HEIGHT, -5)
    match.humanController.onFire()
    step(match, scene, 45)
    expect(mate.deaths).toBe(0)
    expect(mate.isRespawning).toBe(false)
    expect(foe1.deaths).toBe(0)                     // the beam died on the teammate's body
    expect(match.human.kills).toBe(0)
  })

  it('2v2: стартовые позиции — команды кучками у двух точек карты', () => {
    const { match } = makeTeamsMatch('2v2')
    const spawns = MAPS[DEFAULT_MAP_ID].spawns
    const near = (p: THREE.Vector3, s: Vec3) => Math.hypot(p.x - s[0], p.z - s[2]) < 3
    for (const p of match.players) expect(near(p.position, spawns[p.team])).toBe(true)
  })

  it('ffa: стартовые позиции из ffaSpawns по слотам', () => {
    const ffa: Vec3[] = [[2, 1.7, 2], [-3, 1.7, 4], [5, 1.7, -6], [-7, 1.7, -2]]
    const { match } = makeTeamsMatch('ffa', ffa)
    for (const p of match.players) {
      expect(p.position.x).toBeCloseTo(ffa[p.id][0])
      expect(p.position.z).toBeCloseTo(ffa[p.id][2])
    }
  })

  it('computeResult: команды ранжируются по сумме киллов; win/draw по своей команде', () => {
    const { match } = makeTeamsMatch('2v2')
    const [mate, foe1, foe2] = match.bots
    match.human.kills = 3; mate.kills = 2            // team 0 → 5
    foe1.kills = 4; foe2.kills = 0                   // team 1 → 4
    const win = (match as any).computeResult('time')
    expect(win.ranking.map((r: { team: number }) => r.team)).toEqual([0, 1])
    expect(win.ranking[0].kills).toBe(5)
    expect(win.outcome).toBe('win')
    expect(win.scores.find((s: { id: number }) => s.id === 3).team).toBe(1)

    foe1.kills = 5                                   // 5:5 — делёж первого места
    const draw = (match as any).computeResult('time')
    expect(draw.outcome).toBe('draw')

    foe1.kills = 7                                   // 5:7 — проигрыш
    expect((match as any).computeResult('time').outcome).toBe('lose')
  })

  it('ffa: уход игрока не завершает матч, пока есть ≥2 команды; счёт помечен left', () => {
    const { match } = makeTeamsMatch('ffa')
    match.handlePlayerLeft(3)
    expect(match.phase).not.toBe('ended')
    const res = (match as any).computeResult('time')
    expect(res.scores.find((s: { id: number }) => s.id === 3).left).toBe(true)
    match.handlePlayerLeft(2)
    expect(match.phase).not.toBe('ended')            // остались я и бот 1 — две команды
    match.handlePlayerLeft(1)
    expect(match.phase).toBe('ended')                // осталась одна команда → немедленный конец
  })

  it('плашки: в 2v2/ffa у ремоутов есть Sprite (noRaycast), у своего нет; прячется со смертью', () => {
    const { match } = makeTeamsMatch('2v2')
    const plateOf = (p: { bodyGroup: THREE.Group }) => p.bodyGroup.children.find(c => (c as THREE.Sprite).isSprite) as THREE.Sprite | undefined
    expect(plateOf(match.human)).toBeUndefined()
    for (const b of match.bots) {
      const plate = plateOf(b)!
      expect(plate).toBeTruthy()
      expect(plate.userData.noRaycast).toBe(true)
    }
    const victim = match.bots[0]
    victim.receiveHit()                              // died → the plate hides with the body
    expect(plateOf(victim)!.visible).toBe(false)
  })

  it('плашки: в 1v1 их нет ни у кого', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
    const roster: RosterEntry[] = [
      { id: 0, name: 'You', color: '#4af', kind: 'human' },
      { id: 1, name: 'Bot', color: '#5af', kind: 'bot', difficulty: 'passive' },
    ]
    const match = new Match({
      scene, camera, controls: { current: { pointerSpeed: 1 } } as any,
      keys: { current: { forward: false, back: false, left: false, right: false } } as any,
      dispatch: vi.fn(), role: 'host', netConfig: { localId: 0, roster },
    })
    for (const p of match.players)
      expect(p.bodyGroup.children.some(c => (c as THREE.Sprite).isSprite)).toBe(false)
  })

  it('nearestEnemy: ближайший живой не-тиммейт', () => {
    const { match } = makeTeamsMatch('2v2')
    const [mate, foe1, foe2] = match.bots
    mate.respawnAt(at(0, -1))                        // тиммейт вплотную — игнорируется
    foe1.respawnAt(at(0, -5))
    foe2.respawnAt(at(0, -20))
    match.human.respawnAt(at(0, 0))
    expect((match as any).nearestEnemy(match.human)).toBe(foe1)
    foe1.receiveHit()                                // ближайший умер → следующий
    expect((match as any).nearestEnemy(match.human)).toBe(foe2)
  })
})
