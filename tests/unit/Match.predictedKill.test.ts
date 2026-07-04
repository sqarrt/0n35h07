// Regression: a FALSE kill prediction on the client (host rejects the claim — block, or the claim is lost and the
// grace expires) must fully revive the opponent, INCLUDING the raycast hitbox. Before the fix, predictOpponentDeath →
// applyDeath → startGhost left the hitbox noRaycast=true forever (setHittable(true) lives only in respawnAt, which
// only runs on a real 'respawn' event) — so every later local raycast passed through the opponent, no claims were
// ever sent again, and the client could not kill that opponent for the rest of the match.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { Player } from '../../src/game/Player'
import type { RosterEntry, Snapshot } from '../../src/net/protocol'
import { toVec3 } from '../../src/net/protocol'
import { EYE_HEIGHT, NET_PREDICT_KILL_MS } from '../../src/constants'

function lockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true })
}
function unlockPointer() {
  Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
}

const ROSTER: RosterEntry[] = [
  { id: 0, name: 'Host', color: '#4af', kind: 'human' },
  { id: 1, name: 'Me', color: '#f44', kind: 'human' },
]

/** Client match: local player (id 1) aims straight at the remote host player (id 0). */
function makeClientMatch() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const match = new Match({
    scene, camera,
    controls: { current: { pointerSpeed: 1 } } as any,
    keys: { current: { forward: false, back: false, left: false, right: false } } as any,
    dispatch: vi.fn(), role: 'client', netConfig: { localId: 1, roster: ROSTER },
  })
  scene.add(match.root)
  match.forceLiveForTest()
  const me = match.players.find(p => p.id === 1)!
  const opp = match.players.find(p => p.id === 0)!
  me.respawnAt(new THREE.Vector3(0, EYE_HEIGHT, 0))
  opp.respawnAt(new THREE.Vector3(0, EYE_HEIGHT, -5))
  camera.position.set(0, EYE_HEIGHT, 0)
  camera.lookAt(0, EYE_HEIGHT, -5)
  return { match, scene, me, opp }
}

function step(match: Match, scene: THREE.Scene, n = 45, dt = 0.016) {
  for (let i = 0; i < n; i++) { scene.updateMatrixWorld(true); match.update(dt) }
}

/** Fire the local player and return the resulting hit claim (what the client would send the host). */
function fireAndClaim(match: Match, scene: THREE.Scene) {
  match.humanController.onFire()
  step(match, scene, 45)   // > BEAM_WINDUP
  return match.drainHitClaim()
}

/** A host snapshot that shows both players alive at their current positions. */
function aliveSnapshot(match: Match): Snapshot {
  const ps = (p: Player) => ({
    id: p.id, pos: toVec3(p.position), aimDir: [0, 0, -1] as [number, number, number],
    alive: true, shieldActive: false, dashing: false, windupProgress: 0, respawning: false,
    restore: p.saveBodyState(),
  })
  return { ackTick: 0, tick: 0, buffered: 0, players: match.players.map(ps) }
}

describe('Match — false kill prediction revives the opponent (hitbox included)', () => {
  let timeOffset = 0
  const realNow = Date.now

  beforeEach(() => {
    lockPointer()
    timeOffset = 0
    vi.spyOn(Date, 'now').mockImplementation(() => realNow.call(Date) + timeOffset)
  })
  afterEach(() => {
    unlockPointer()
    vi.restoreAllMocks()
  })

  it('claim rejected via BLOCK → the opponent is hittable again (a second shot claims a hit)', () => {
    const { match, scene, me, opp } = makeClientMatch()

    const first = fireAndClaim(match, scene)
    expect(first?.hitId).toBe(0)          // sanity: the local raycast hit the opponent
    expect(opp.alive).toBe(false)         // death predicted locally

    match.applyEvent({ t: 'block', shooter: 1, victim: 0, perfect: true })   // host: shield blocked it
    match.applySnapshot(aliveSnapshot(match))                                // host still shows the opponent alive
    expect(opp.alive).toBe(true)

    me.resetCooldowns()
    const second = fireAndClaim(match, scene)
    expect(second?.hitId).toBe(0)         // the revived opponent must be raycastable again
  })

  it('claim lost (no kill/block arrives) → grace expiry revert makes the opponent hittable again', () => {
    const { match, scene, me, opp } = makeClientMatch()

    const first = fireAndClaim(match, scene)
    expect(first?.hitId).toBe(0)
    expect(opp.alive).toBe(false)

    timeOffset += NET_PREDICT_KILL_MS + 50            // grace expires, no host verdict came
    match.applySnapshot(aliveSnapshot(match))          // predict_revert → revive
    expect(opp.alive).toBe(true)

    me.resetCooldowns()
    const second = fireAndClaim(match, scene)
    expect(second?.hitId).toBe(0)
  })
})
