import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { BotDifficulty, MapId } from '../../src/constants'
import { EYE_HEIGHT } from '../../src/constants'
import type { RosterEntry } from '../../src/net/protocol'
import { MAPS } from '../../src/game/maps'

function lockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true })
}
function unlockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
}

/** Строит host-матч 1v1 (вы + бот) и пропускает отсчёт (forceLiveForTest) — тестируем боёвку. */
function makeMatch(difficulty: BotDifficulty = 'passive', mapId?: MapId) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const controls = { current: { pointerSpeed: 1 } }
  const keys = { current: { forward: false, back: false, left: false, right: false } }
  const dispatch = vi.fn()
  const roster: RosterEntry[] = [
    { id: 0, name: 'Вы', color: '#4af', kind: 'human' },
    { id: 1, name: 'Бот', color: '#5af', kind: 'bot', difficulty },
  ]
  const match = new Match({
    scene, camera, controls: controls as any, keys: keys as any, dispatch,
    role: 'host', netConfig: { localId: 0, roster }, mapId,
  })
  scene.add(match.root)   // тела игроков + лучи (для raycast боёвки)
  match.installDebug(camera)
  match.forceLiveForTest()
  return { match, scene, camera, dispatch }
}

/** Прогоняет кадры, обновляя мировые матрицы (в тестах нет рендер-цикла R3F). */
function step(match: Match, scene: THREE.Scene, n = 45, dt = 0.016) {
  for (let i = 0; i < n; i++) { scene.updateMatrixWorld(true); match.update(dt) }
}

/** Ставит человека целиться точно в бота перед ним. */
function aimHumanAtBot(match: Match, camera: THREE.PerspectiveCamera) {
  match.human.respawnAt(new THREE.Vector3(0, EYE_HEIGHT, 0))
  match.bots[0].respawnAt(new THREE.Vector3(0, EYE_HEIGHT, -5))
  camera.position.set(0, EYE_HEIGHT, 0)
  camera.lookAt(0, EYE_HEIGHT, -5)
}

const hitCount = () => (window as any).__debugTargetHitCount ?? 0

describe('Match', () => {
  beforeEach(lockPointer)
  afterEach(() => {
    unlockPointer()
    const w = window as any
    delete w.__debugCamera; delete w.__debugWindup; delete w.__debugTargetHitCount; delete w.__debugBotPos
  })

  it('матч стартует сразу с отсчёта (ready-ритуала в матче нет)', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
    const roster: RosterEntry[] = [
      { id: 0, name: 'Вы', color: '#4af', kind: 'human' },
      { id: 1, name: 'Бот', color: '#5af', kind: 'bot', difficulty: 'passive' },
    ]
    const match = new Match({
      scene, camera,
      controls: { current: { pointerSpeed: 1 } } as any,
      keys: { current: { forward: false, back: false, left: false, right: false } } as any,
      dispatch: vi.fn(), role: 'host', netConfig: { localId: 0, roster },
    })
    expect(match.phase).toBe('countdown')
  })

  it('спавнит игроков по слотам выбранной карты (os_pillars)', () => {
    const { match } = makeMatch('passive', 'os_pillars')
    expect(match.human.position.toArray()).toEqual(MAPS.os_pillars.spawns[0])
    expect(match.bots[0].position.toArray()).toEqual(MAPS.os_pillars.spawns[1])
  })

  it('человек убивает пассивного бота: hitCount + BEAM_FLASH + бот в фазе призрака', () => {
    const { match, scene, camera, dispatch } = makeMatch('passive')
    aimHumanAtBot(match, camera)
    match.humanController.onFire()
    step(match, scene, 45)             // > windup 400мс
    expect(hitCount()).toBe(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'BEAM_FLASH' })
    expect(match.bots[0].isRespawning).toBe(true)   // погиб → фаза призрака (1.5с)
  })

  it('убийство ведёт K/D и шлёт SET_SCORES', () => {
    const { match, scene, camera, dispatch } = makeMatch('passive')
    aimHumanAtBot(match, camera)
    match.humanController.onFire()
    step(match, scene, 45)
    expect(match.human.kills).toBe(1)
    expect(match.bots[0].deaths).toBe(1)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_SCORES' }))
  })

  it('попадание в бота со щитом → BOT_SHIELD_HIT, без хита', () => {
    const { match, scene, camera, dispatch } = makeMatch('passive')
    aimHumanAtBot(match, camera)
    match.bots[0].activateShield()     // щит держится 1500мс > windup
    match.humanController.onFire()
    step(match, scene, 45)
    expect(dispatch).toHaveBeenCalledWith({ type: 'BOT_SHIELD_HIT' })
    expect(hitCount()).toBe(0)
  })

  it('смерть игрока не трогает соперника (фаза призрака только у погибшего)', () => {
    const { match, scene } = makeMatch('passive')
    const botBefore = match.bots[0].position.clone()
    match.human.receiveHit()
    expect(match.human.isRespawning).toBe(true)
    expect(match.bots[0].isRespawning).toBe(false)   // соперник не в фазе
    step(match, scene, 20)
    expect(match.bots[0].alive).toBe(true)
    expect(match.bots[0].position.distanceTo(botBefore)).toBeLessThan(0.01)
  })

  it('windupFx: world-объекты в root, стиль из ростера попадает в Player', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
    const roster: RosterEntry[] = [
      { id: 0, name: 'Вы', color: '#4af', kind: 'human', windupStyle: 'rage', respawnStyle: 'swarm',
        dashStyle: 'rift', shieldStyle: 'hex' },
      { id: 1, name: 'Бот', color: '#5af', kind: 'bot', difficulty: 'passive' },
    ]
    const match = new Match({
      scene, camera,
      controls: { current: { pointerSpeed: 1 } } as any,
      keys: { current: { forward: false, back: false, left: false, right: false } } as any,
      dispatch: vi.fn(), role: 'host', netConfig: { localId: 0, roster },
    })
    expect(match.human.windupStyle).toBe('rage')
    expect(match.bots[0].windupStyle).toBe('classic')           // у бота стиля нет → classic
    expect(match.human.windupFxObject.parent).toBe(match.root)
    expect(match.bots[0].windupFxObject.parent).toBe(match.root)
    expect(match.human.respawnStyle).toBe('swarm')              // стиль респавна тоже из ростера
    expect(match.bots[0].respawnStyle).toBe('echo')
    expect(match.human.respawnFxObject.parent).toBe(match.root)
    expect(match.human.dashStyle).toBe('rift')                  // скины рывка/щита из ростера
    expect(match.bots[0].dashStyle).toBe('streak')
    expect(match.human.trailObject.parent).toBe(match.root)
  })

  it('по истечении фазы игрок материализуется НА МЕСТЕ остановки (не на рандоме)', () => {
    const { match, scene } = makeMatch('passive')
    match.human.respawnAt(new THREE.Vector3(2, EYE_HEIGHT, 3))   // в известную точку, alive
    match.human.receiveHit()                                     // → призрак (без ввода — стоит)
    const ghostPos = match.human.position.clone()
    step(match, scene, 100)                                      // > RESPAWN_GHOST_MS (1.5с)
    expect(match.human.alive).toBe(true)
    expect(match.human.isRespawning).toBe(false)
    expect(match.human.position.distanceTo(ghostPos)).toBeLessThan(0.5)
  })
})
