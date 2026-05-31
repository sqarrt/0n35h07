import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { BotDifficulty } from '../../src/constants'
import { EYE_HEIGHT } from '../../src/constants'

function lockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true })
}
function unlockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
}

function makeMatch(botDifficulties: BotDifficulty[]) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const controls = { current: { pointerSpeed: 1 } }
  const keys = { current: { forward: false, back: false, left: false, right: false } }
  const dispatch = vi.fn()
  const match = new Match({ scene, camera, controls: controls as any, keys: keys as any, dispatch, botDifficulties })
  scene.add(match.root)   // тела игроков + лучи (для raycast боёвки)
  match.installDebug(camera)
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

  it('человек убивает пассивного бота: hitCount + BEAM_FLASH + респавн', () => {
    const { match, scene, camera, dispatch } = makeMatch(['passive'])
    aimHumanAtBot(match, camera)
    match.humanController.onFire()
    step(match, scene, 45)             // > windup 400мс
    expect(hitCount()).toBe(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'BEAM_FLASH' })
    expect(match.bots[0].alive).toBe(true)   // погиб и уже респавнулся
  })

  it('попадание в бота со щитом → BOT_SHIELD_HIT, без хита', () => {
    const { match, scene, camera, dispatch } = makeMatch(['passive'])
    aimHumanAtBot(match, camera)
    match.bots[0].activateShield()     // щит держится 1500мс > windup
    match.humanController.onFire()
    step(match, scene, 45)
    expect(dispatch).toHaveBeenCalledWith({ type: 'BOT_SHIELD_HIT' })
    expect(hitCount()).toBe(0)
  })

  it('смерть человека не респавнит ботов (респавнится только погибший)', () => {
    const { match, scene } = makeMatch(['passive', 'passive'])
    const before = match.bots.map(b => b.position.clone())
    match.human.receiveHit()
    expect(match.human.alive).toBe(false)
    step(match, scene, 20)             // > RESPAWN_DELAY 150мс
    expect(match.human.alive).toBe(true)
    match.bots.forEach((b, i) => {
      expect(b.alive).toBe(true)
      expect(b.position.distanceTo(before[i])).toBeLessThan(0.01)
    })
  })
})
