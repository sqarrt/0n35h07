import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player } from '../../src/game/Player'
import { Body } from '../../src/game/Body'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import { Shield } from '../../src/game/Shield'
import type { IWeapon, WeaponContext, FireOutcome } from '../../src/game/abstractions'
import { MUZZLE_Y, MOVE_SPEED, RESPAWN_SPEED_MULT } from '../../src/constants'
import type { IWindupFx, WindupTarget, WindupFrame } from '../../src/game/fx/windup/types'

function makePlayer(id = 1) {
  return new Player(id, new Body(id, '#5af'), new BeamWeapon(), new Shield(), '#5af')
}

const dummyWorld = { raycast: () => null } as any

/** Stub weapon: remembers the aim direction passed from Player.update. */
class StubWeapon implements IWeapon {
  object3d = new THREE.Group()
  isWindingUp = false
  windupProgress = 0
  justFired = false
  outcome: FireOutcome | null = null
  lastAim?: THREE.Vector3
  beginWindup() {}
  update(_dt: number, ctx: WeaponContext) { this.lastAim = ctx.aim.clone() }
  reset() {}
  interrupt() {}
  spawnImpact() {}
  cooldownProgress() { return 1 }
  clearJustFired() {}
  dispose() {}
}

describe('Player', () => {
  it('receiveHit() without a shield → killed, alive=false, sets respawnTimer', () => {
    const p = makePlayer()
    expect(p.receiveHit()).toBe('killed')
    expect(p.alive).toBe(false)
    expect(p.respawnTimer).toBeGreaterThan(0)
  })

  it('receiveHit() with an active shield → blocked, stays alive', () => {
    const p = makePlayer()
    p.activateShield()                 // shield is active right after activate()
    expect(p.receiveHit()).toBe('blocked')
    expect(p.alive).toBe(true)
  })

  it('respawnAt() restores and repositions', () => {
    const p = makePlayer()
    p.receiveHit()
    p.respawnAt(new THREE.Vector3(3, 1.7, -2))
    expect(p.alive).toBe(true)
    expect(p.position.x).toBe(3)
    expect(p.position.z).toBe(-2)
  })

  it('moveIntent() accumulates intent (Rapier KCC does the integration)', () => {
    const p = makePlayer()
    p.moveIntent(new THREE.Vector3(2, 0, 0), 1)
    p.stepHorizontal(0.016, null)   // the velocity model turns intent into desired
    expect(p.consumeDesired().x).toBeGreaterThan(0)
  })

  it('startFiring() puts the weapon into windup (built-in cooldown)', () => {
    const p = makePlayer()
    expect(p.isWindingUp).toBe(false)
    p.startFiring()
    expect(p.isWindingUp).toBe(true)
  })

  // --- regressions after the OOP refactor ---

  it('beam converges TO the aim point from the muzzle, not parallel (TP fix)', () => {
    const stub = new StubWeapon()
    const p = new Player(0, new Body(0, '#4af'), stub, new Shield(), '#4af')
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    const point = new THREE.Vector3(0, 1.0, -10)        // below the eye line
    p.aim(point)
    p.update(0.016, dummyWorld, [])
    const muzzle = new THREE.Vector3(0, 1.7 + MUZZLE_Y, 0)
    const expected = point.clone().sub(muzzle).normalize()
    expect(stub.lastAim!.x).toBeCloseTo(expected.x)
    expect(stub.lastAim!.y).toBeCloseTo(expected.y)
    expect(stub.lastAim!.z).toBeCloseTo(expected.z)
    expect(stub.lastAim!.y).toBeLessThan(0)             // aiming down — not parallel
  })

  it('in FP (body hidden) the shield bubble is not drawn (FP fix)', () => {
    const shield = new Shield()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), shield, '#4af')
    p.setBodyVisible(false)
    p.activateShield()
    p.update(0.016, dummyWorld, [])
    expect(shield.object3d.visible).toBe(false)         // hidden even though the shield is active
    p.setBodyVisible(true)
    p.update(0.016, dummyWorld, [])
    expect(shield.object3d.visible).toBe(true)          // visible in TP
  })

  it('setFrozen(true) suppresses movement/firing/shield, but not aiming', () => {
    const p = makePlayer()
    p.setFrozen(true)
    p.moveIntent(new THREE.Vector3(5, 0, 0), 1)
    expect(p.consumeDesired().x).toBe(0)         // movement frozen
    p.startFiring()
    expect(p.isWindingUp).toBe(false)            // firing frozen
    p.activateShield()
    expect(p.shieldActive).toBe(false)           // shield frozen
    p.setFrozen(false)
    p.moveIntent(new THREE.Vector3(5, 0, 0), 1)
    p.stepHorizontal(0.016, null)
    expect(p.consumeDesired().x).toBeGreaterThan(0)  // unfrozen — moves
  })

  it('in FP (body hidden) own dash trail is not drawn', () => {
    const p = makePlayer()
    p.setBodyVisible(false)
    expect(p.trailObject.visible).toBe(false)   // camera inside the body — we don't show the clones
    p.setBodyVisible(true)
    expect(p.trailObject.visible).toBe(true)     // visible in TP / for other players
  })

  it('dash during windup interrupts the shot WITHOUT a cooldown (there was no beam)', () => {
    const p = makePlayer()
    p.startFiring()
    expect(p.isWindingUp).toBe(true)
    p.dash(new THREE.Vector3(0, 0, -1))
    expect(p.isWindingUp).toBe(false)
    expect(p.beamCooldownProgress()).toBe(1)   // windup interrupted without firing → no cooldown charged
  })

  it('dash without a direction — does not dash and does not interrupt windup', () => {
    const p = makePlayer()
    p.startFiring()
    p.dash(new THREE.Vector3(0, 0, 0))
    expect(p.isWindingUp).toBe(true)
  })

  it('death starts the ghost phase: alive=false, isRespawning, attack blocked', () => {
    const p = makePlayer()
    expect(p.receiveHit()).toBe('killed')
    expect(p.alive).toBe(false)
    expect(p.isRespawning).toBe(true)
    p.startFiring();    expect(p.isWindingUp).toBe(false)   // can't fire
    p.activateShield(); expect(p.shieldActive).toBe(false)  // can't shield
  })

  it('the ghost moves RESPAWN_SPEED_MULT times faster than usual', () => {
    const live = makePlayer()
    live.moveIntent(new THREE.Vector3(MOVE_SPEED, 0, 0), 1)
    const liveDx = live.consumeDesired().x

    const ghost = makePlayer()
    ghost.receiveHit()
    ghost.moveIntent(new THREE.Vector3(MOVE_SPEED, 0, 0), 1)
    expect(ghost.consumeDesired().x).toBeCloseTo(liveDx * RESPAWN_SPEED_MULT)
  })

  it('a repeated hit on the ghost — blocked (no double kill)', () => {
    const p = makePlayer()
    expect(p.receiveHit()).toBe('killed')
    expect(p.receiveHit()).toBe('blocked')
  })

  it('respawnAt materializes in place: alive, !isRespawning, attack available again', () => {
    const p = makePlayer()
    p.receiveHit()
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    expect(p.alive).toBe(true)
    expect(p.isRespawning).toBe(false)
    p.startFiring(); expect(p.isWindingUp).toBe(true)
  })

  it('respawn resets ALL cooldowns (beam/shield/dash ready)', () => {
    const p = makePlayer()
    p.startFiring()
    p.update(0.5, dummyWorld, [])            // > windup → shot → beam cooldown
    p.activateShield()                        // shield → cooldown
    p.dash(new THREE.Vector3(0, 0, -1))       // dash → cooldown
    expect(p.beamCooldownProgress()).toBeLessThan(1)
    expect(p.dashCooldownProgress()).toBeLessThan(1)

    p.receiveHit()                            // death → ghost
    p.respawnAt(new THREE.Vector3(0, 1.7, 0)) // materialization
    expect(p.beamCooldownProgress()).toBe(1)
    expect(p.shieldProgress()).toBe(1)
    expect(p.dashCooldownProgress()).toBe(1)
  })
})

/** Fake strategy: records the last frame. */
class FakeWindupFx implements IWindupFx {
  object3d = new THREE.Group()
  lastFrame: WindupFrame | null = null
  apply(_dt: number, _t: WindupTarget, f: WindupFrame) { this.lastFrame = { ...f } }
  dispose() {}
}

describe('Player + IWindupFx', () => {
  it('default — classic (without an explicit fx, Player is created and behaves as before)', () => {
    const p = makePlayer()
    expect(p.windupStyle).toBe('classic')
    expect(p.windupFxObject).toBeDefined()
  })

  it('passes windup progress into the strategy', () => {
    const stub = new StubWeapon()
    const fx = new FakeWindupFx()
    const p = new Player(0, new Body(0, '#4af'), stub, new Shield(), '#4af', fx, 'rage')
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    stub.windupProgress = 0.6
    p.update(0.016, dummyWorld, [])
    expect(p.windupStyle).toBe('rage')
    expect(fx.lastFrame!.progress).toBeCloseTo(0.6)
    expect(fx.lastFrame!.visible).toBe(true)
  })

  it('the ghost (death) hides the strategy world object', () => {
    const fx = new FakeWindupFx()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af', fx, 'classic')
    fx.object3d.visible = true
    p.receiveHit()
    p.update(0.016, dummyWorld, [])
    expect(fx.object3d.visible).toBe(false)
  })

  it('the ghost hides the world object in updateRemote too (network path)', () => {
    const fx = new FakeWindupFx()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af', fx, 'classic')
    fx.object3d.visible = true
    p.receiveHit()
    p.updateRemote(0.016, dummyWorld)
    expect(fx.object3d.visible).toBe(false)
  })
})

import type { IRespawnFx, RespawnTarget, RespawnFrame } from '../../src/game/fx/respawn/types'

/** Fake respawn strategy: records events and the last frame. */
class FakeRespawnFx implements IRespawnFx {
  object3d = new THREE.Group()
  deaths: THREE.Vector3[] = []
  lastFrame: RespawnFrame | null = null
  onDeath(p: THREE.Vector3) { this.deaths.push(p.clone()) }
  apply(_dt: number, _t: RespawnTarget, f: RespawnFrame) { this.lastFrame = { ...f } }
  isRebirthActive() { return false }
  update() {}
  dispose() {}
}

describe('Player + IRespawnFx', () => {
  it('default — echo, world object is available', () => {
    const p = makePlayer()
    expect(p.respawnStyle).toBe('echo')
    expect(p.respawnFxObject).toBeDefined()
  })

  it('death triggers onDeath; the ghost frame passes the ghost progress', () => {
    const fx = new FakeRespawnFx()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af',
      undefined, undefined, fx, 'chaos')
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    p.receiveHit()
    expect(fx.deaths.length).toBe(1)
    p.update(0.016, dummyWorld, [])
    expect(fx.lastFrame!.ghost).toBeGreaterThan(0.9)            // the phase just started (remainder ~1)
    expect(p.respawnStyle).toBe('chaos')
  })

  it('after respawnAt the frame leaves ghost (ghost=null, sinceRebirthMs small)', () => {
    const fx = new FakeRespawnFx()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af',
      undefined, undefined, fx, 'echo')
    p.receiveHit()
    p.respawnAt(new THREE.Vector3(1, 1.7, 1))
    p.update(0.016, dummyWorld, [])
    expect(fx.lastFrame!.ghost).toBeNull()
    expect(fx.lastFrame!.sinceRebirthMs).toBeLessThan(1000)
  })
})

import type { IDashTrail, DashTrailContext } from '../../src/game/abstractions'

/** Fake dash trail: records the dashing flags it saw. */
class FakeDashTrail implements IDashTrail {
  object3d = new THREE.Group()
  aliveCount = 0
  dashingLog: boolean[] = []
  update(_dt: number, ctx: DashTrailContext) { this.dashingLog.push(ctx.dashing) }
  dispose() {}
}

describe('Player + IDashTrail (dash trail skin)', () => {
  it('default — streak, world object is available', () => {
    const p = makePlayer()
    expect(p.dashStyle).toBe('streak')
    expect(p.trailObject).toBeDefined()
  })

  it('the injected trail gets dashing=true on the dash frame', () => {
    const fx = new FakeDashTrail()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af',
      undefined, undefined, undefined, undefined, fx, 'wave')
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    p.update(0.016, dummyWorld, [])
    expect(fx.dashingLog).toEqual([false])
    p.dash(new THREE.Vector3(1, 0, 0))
    p.update(0.016, dummyWorld, [])
    expect(fx.dashingLog).toEqual([false, true])
    expect(p.dashStyle).toBe('wave')
    expect(p.trailObject).toBe(fx.object3d)
  })

  it('the ghost does NOT reuse the dash skin: the ghost trail is drawn by the respawn strategy', () => {
    const fx = new FakeDashTrail()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af',
      undefined, undefined, undefined, undefined, fx, 'rift')
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    p.receiveHit()                            // ghost phase (echo — its own trail inside respawnFx)
    p.update(0.016, dummyWorld, [])
    expect(fx.dashingLog).toEqual([false])    // the dash skin stays silent during the ghost phase
  })
})
