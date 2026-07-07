// Regression: a FALSE kill prediction (the victim's owner rejects the claim — block, or the claim is lost and the
// grace expires) must fully revive the remote victim, INCLUDING the raycast hitbox. Before the fix, predictOpponentDeath →
// applyDeath → startGhost left the hitbox noRaycast=true forever — so every later local raycast passed through the
// victim and no claims were ever sent again.
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
  { id: 0, name: 'Them', color: '#4af', kind: 'human' },
  { id: 1, name: 'Me', color: '#f44', kind: 'human' },
]

/** Mesh peer: local player (id 1, owner ME) aims straight at the remote victim (id 0, owner X). */
function makePeerMatch() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  const match = new Match({
    scene, camera,
    controls: { current: { pointerSpeed: 1 } } as any,
    keys: { current: { forward: false, back: false, left: false, right: false } } as any,
    dispatch: vi.fn(), role: 'peer', netConfig: { localId: 1, roster: ROSTER },
    owners: { 0: 'X', 1: 'ME' }, selfPeer: 'ME',
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

/** Fire the local player and return the addressed claim (what this peer would send the victim's owner). */
function fireAndClaim(match: Match, scene: THREE.Scene) {
  match.humanController.onFire()
  step(match, scene, 45)   // > BEAM_WINDUP
  const out = match.drainClaims()
  return out[0]
}

/** The victim owner's snapshot showing ITS player (id 0) alive at the current position. */
function aliveSnapshot(opp: Player): Snapshot {
  return {
    ackTick: 0, tick: 0, buffered: 0,
    players: [{
      id: opp.id, pos: toVec3(opp.position), aimDir: [0, 0, -1] as [number, number, number],
      alive: true, shieldActive: false, dashing: false, windupProgress: 0, respawning: false,
      restore: opp.saveBodyState(),
    }],
  }
}

describe('Match — false kill prediction revives the remote victim (hitbox included)', () => {
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

  it('claim rejected via BLOCK (owner event) → the victim is hittable again (a second shot claims a hit)', () => {
    const { match, scene, me, opp } = makePeerMatch()

    const first = fireAndClaim(match, scene)
    expect(first?.claim.hitId).toBe(0)    // sanity: the local raycast hit the victim
    expect(first?.to).toBe('X')           // addressed to the victim's owner
    expect(opp.alive).toBe(false)         // death predicted locally

    match.applyPeerEvent('X', { t: 'block', shooter: 1, victim: 0, perfect: true })   // the owner's shield blocked it
    match.applyPeerSnapshot('X', aliveSnapshot(opp))                                  // the owner still shows it alive
    expect(opp.alive).toBe(true)

    me.resetCooldowns()
    const second = fireAndClaim(match, scene)
    expect(second?.claim.hitId).toBe(0)   // the revived victim must be raycastable again
  })

  it('claim lost (no kill/block arrives) → grace expiry revert makes the victim hittable again', () => {
    const { match, scene, me, opp } = makePeerMatch()

    const first = fireAndClaim(match, scene)
    expect(first?.claim.hitId).toBe(0)
    expect(opp.alive).toBe(false)

    timeOffset += NET_PREDICT_KILL_MS + 50               // grace expires, no verdict came
    match.applyPeerSnapshot('X', aliveSnapshot(opp))      // predict_revert → revive
    expect(opp.alive).toBe(true)

    me.resetCooldowns()
    const second = fireAndClaim(match, scene)
    expect(second?.claim.hitId).toBe(0)
  })
})
