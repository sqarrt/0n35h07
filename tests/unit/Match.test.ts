import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { BotDifficulty, MapId } from '../../src/constants'
import { EYE_HEIGHT } from '../../src/constants'
import type { RosterEntry } from '../../src/net/protocol'
import { MAPS } from '../../src/game/maps'
import { encodeBallArt, makeEmptyArt } from '../../src/game/ballArt'

function lockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true })
}
function unlockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
}

/** Builds a 1v1 host match (you + bot) and skips the ready ritual — testing combat. */
function makeMatch(difficulty: BotDifficulty = 'passive', mapId?: MapId) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const controls = { current: { pointerSpeed: 1 } }
  const keys = { current: { forward: false, back: false, left: false, right: false } }
  const dispatch = vi.fn()
  const roster: RosterEntry[] = [
    { id: 0, name: 'You', color: '#4af', kind: 'human' },
    { id: 1, name: 'Bot', color: '#5af', kind: 'bot', difficulty },
  ]
  const match = new Match({
    scene, camera, controls: controls as any, keys: keys as any, dispatch,
    role: 'host', netConfig: { localId: 0, roster }, mapId,
  })
  scene.add(match.root)   // player bodies + beams (for raycast combat)
  match.installDebug(camera)
  match.forceLiveForTest()
  return { match, scene, camera, dispatch }
}

/** Runs frames, updating world matrices (no R3F render loop in tests). */
function step(match: Match, scene: THREE.Scene, n = 45, dt = 0.016) {
  for (let i = 0; i < n; i++) { scene.updateMatrixWorld(true); match.update(dt) }
}

/** Makes the human aim precisely at the bot in front of them. */
function aimHumanAtBot(match: Match, camera: THREE.PerspectiveCamera) {
  match.human.respawnAt(new THREE.Vector3(0, EYE_HEIGHT, 0))
  match.bots[0].respawnAt(new THREE.Vector3(0, EYE_HEIGHT, -5))
  camera.position.set(0, EYE_HEIGHT, 0)
  camera.lookAt(0, EYE_HEIGHT, -5)
}

const hitCount = () => (window as any).__debugTargetHitCount ?? 0

describe('Match ballArt', () => {
  beforeEach(lockPointer)
  afterEach(unlockPointer)

  it('the drawing from the roster decodes into Body without throwing', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
    const art = makeEmptyArt(); art.front[0] = 1
    const roster: RosterEntry[] = [
      { id: 0, name: 'You', color: '#4af', kind: 'human', ballArt: encodeBallArt(art) },
      { id: 1, name: 'Bot', color: '#5af', kind: 'bot', difficulty: 'passive' },
    ]
    const match = new Match({
      scene, camera, controls: { current: { pointerSpeed: 1 } } as any,
      keys: { current: { forward: false, back: false, left: false, right: false } } as any,
      dispatch: vi.fn(), role: 'host', netConfig: { localId: 0, roster },
    })
    expect(match.human).toBeTruthy()
    expect(match.bots[0]).toBeTruthy()
  })
})

describe('Match', () => {
  beforeEach(lockPointer)
  afterEach(() => {
    unlockPointer()
    const w = window as any
    delete w.__debugCamera; delete w.__debugWindup; delete w.__debugTargetHitCount; delete w.__debugBotPos
  })

  it('spawns players at the slots of the selected map (os_pillars)', () => {
    const { match } = makeMatch('passive', 'os_pillars')
    expect(match.human.position.toArray()).toEqual(MAPS.os_pillars.spawns[0])
    expect(match.bots[0].position.toArray()).toEqual(MAPS.os_pillars.spawns[1])
  })

  it('human kills a passive bot: hitCount + BEAM_FLASH + bot in ghost phase', () => {
    const { match, scene, camera, dispatch } = makeMatch('passive')
    aimHumanAtBot(match, camera)
    match.humanController.onFire()
    step(match, scene, 45)             // > windup 400ms
    expect(hitCount()).toBe(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'BEAM_FLASH' })
    expect(match.bots[0].isRespawning).toBe(true)   // died → ghost phase (1.5s)
  })

  it('a kill tracks K/D and sends SET_SCORES', () => {
    const { match, scene, camera, dispatch } = makeMatch('passive')
    aimHumanAtBot(match, camera)
    match.humanController.onFire()
    step(match, scene, 45)
    expect(match.human.kills).toBe(1)
    expect(match.bots[0].deaths).toBe(1)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_SCORES' }))
  })

  it('hitting a bot with a shield → BOT_SHIELD_HIT, no hit', () => {
    const { match, scene, camera, dispatch } = makeMatch('passive')
    aimHumanAtBot(match, camera)
    match.bots[0].activateShield()     // shield holds 800ms > hit (~400ms)
    match.humanController.onFire()
    step(match, scene, 45)
    expect(dispatch).toHaveBeenCalledWith({ type: 'BOT_SHIELD_HIT' })
    expect(hitCount()).toBe(0)
  })

  it('perfect block (shield raised <100ms before the beam) → cooldown reset: shield reusable immediately', () => {
    const { match, scene, camera, dispatch } = makeMatch('passive')
    aimHumanAtBot(match, camera)
    match.humanController.onFire()
    step(match, scene, 23)                 // BEAM_WINDUP=400ms → hit ~frame 25; shield not raised yet
    match.bots[0].activateShield()         // raised "at the moment" of the hit → perfect block
    step(match, scene, 5)                  // beam arrives, block counted
    expect(hitCount()).toBe(0)
    expect(dispatch).toHaveBeenCalledWith({ type: 'BOT_SHIELD_HIT' })
    // reward: after the active shield window there is no cooldown — raises again right away
    step(match, scene, 55)                 // > SHIELD_DURATION (800ms) since activation
    expect(match.bots[0].shieldActive).toBe(false)
    match.bots[0].activateShield()
    expect(match.bots[0].shieldActive).toBe(true)
  })

  it('a BOT kills the human: the bot\'s hit RESOLVES (regression — host resolves ALL host-simulated shooters, not just localId)', () => {
    const { match, scene } = makeMatch('passive')       // passive bot → its controller is a no-op; we drive its weapon directly
    match.bots[0].respawnAt(new THREE.Vector3(0, EYE_HEIGHT, 0))
    match.human.respawnAt(new THREE.Vector3(0, EYE_HEIGHT, -5))
    const target = new THREE.Vector3(0, EYE_HEIGHT, -5) // the human, straight ahead
    match.bots[0].startFiring()
    for (let i = 0; i < 45; i++) { match.bots[0].aim(target); scene.updateMatrixWorld(true); match.update(0.016) } // > windup 400ms
    // Before the fix the host only resolved shooter.id === localId, so a bot's beam never registered — the human lived.
    expect(match.human.isRespawning).toBe(true)   // bot's beam hit → human died (ghost phase)
    expect(match.bots[0].kills).toBe(1)
    expect(match.human.deaths).toBe(1)
  })

  it("a player's death does not affect the opponent (ghost phase only for the deceased)", () => {
    const { match, scene } = makeMatch('passive')
    const botBefore = match.bots[0].position.clone()
    match.human.receiveHit()
    expect(match.human.isRespawning).toBe(true)
    expect(match.bots[0].isRespawning).toBe(false)   // opponent not in the phase
    step(match, scene, 20)
    expect(match.bots[0].alive).toBe(true)
    expect(match.bots[0].position.distanceTo(botBefore)).toBeLessThan(0.01)
  })

  it('windupFx: world objects in root, style from the roster reaches Player', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
    const roster: RosterEntry[] = [
      { id: 0, name: 'You', color: '#4af', kind: 'human', windupStyle: 'rage', respawnStyle: 'swarm',
        dashStyle: 'rift', shieldStyle: 'hex' },
      { id: 1, name: 'Bot', color: '#5af', kind: 'bot', difficulty: 'passive' },
    ]
    const match = new Match({
      scene, camera,
      controls: { current: { pointerSpeed: 1 } } as any,
      keys: { current: { forward: false, back: false, left: false, right: false } } as any,
      dispatch: vi.fn(), role: 'host', netConfig: { localId: 0, roster },
    })
    expect(match.human.windupStyle).toBe('rage')
    expect(match.bots[0].windupStyle).toBe('classic')           // bot has no style → classic
    expect(match.human.windupFxObject.parent).toBe(match.root)
    expect(match.bots[0].windupFxObject.parent).toBe(match.root)
    expect(match.human.respawnStyle).toBe('swarm')              // respawn style also from the roster
    expect(match.bots[0].respawnStyle).toBe('echo')
    expect(match.human.respawnFxObject.parent).toBe(match.root)
    expect(match.human.dashStyle).toBe('rift')                  // dash/shield skins from the roster
    expect(match.bots[0].dashStyle).toBe('streak')
    expect(match.human.trailObject.parent).toBe(match.root)
  })

  it('after the phase ends the player materializes AT the stop position (not at random)', () => {
    const { match, scene } = makeMatch('passive')
    match.human.respawnAt(new THREE.Vector3(2, EYE_HEIGHT, 3))   // at a known point, alive
    match.human.receiveHit()                                     // → ghost (no input — stays put)
    const ghostPos = match.human.position.clone()
    step(match, scene, 100)                                      // > RESPAWN_GHOST_MS (1.5s)
    expect(match.human.alive).toBe(true)
    expect(match.human.isRespawning).toBe(false)
    expect(match.human.position.distanceTo(ghostPos)).toBeLessThan(0.5)
  })
})
