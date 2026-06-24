import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Body } from '../../src/game/Body'
import { JUMP_FORCE, DASH_DURATION, MOVE_SPEED, MAX_SPEED } from '../../src/constants'
import { makeEmptyArt, BALL_ART_SIZE } from '../../src/game/ballArt'

// Body no longer integrates position (Rapier KCC does that) — it accumulates INTENT via a velocity model.
describe('Body', () => {
  it('move()+stepHorizontal: accelerates desired horizontal into desired (does not touch Y)', () => {
    const b = new Body(0, '#4af')
    b.move(new THREE.Vector3(MOVE_SPEED, 99, 0), 1)   // want +X (Y of horizontal is ignored)
    b.stepHorizontal(0.016, null)                     // on the ground — accelerate to wishspeed
    const d = b.consumeDesired()
    expect(d.x).toBeGreaterThan(0)   // velH accelerated in +X → desired.x > 0
    expect(d.z).toBe(0)
    expect(d.y).toBe(0)              // horizontal does not touch Y (Y — gravity in stepVertical)
    expect(b.consumeDesired().x).toBe(0)   // consumeDesired resets to zero
  })

  it('jump (held): liftoff on ground; holding in air does not jump; new press → double jump', () => {
    const b = new Body(0, '#4af')
    expect(b.grounded).toBe(true)
    b.setJumpInput(true)
    b.stepJump()
    expect(b.velocityY).toBe(JUMP_FORCE)   // jump from the ground (+ restored the air jump)
    b.setGrounded(false)
    b.velocityY = 0
    b.stepJump()                           // jumpHeld still true (NOT an edge) → no jump in air
    expect(b.velocityY).toBe(0)
    b.setJumpInput(false); b.stepJump()    // released
    b.setJumpInput(true);  b.stepJump()    // NEW press in air → double jump
    expect(b.velocityY).toBe(JUMP_FORCE)
    b.velocityY = 0
    b.setJumpInput(false); b.stepJump()
    b.setJumpInput(true);  b.stepJump()    // air jumps exhausted (MAX_AIR_JUMPS=1) → none
    expect(b.velocityY).toBe(0)
  })

  it('speed cap: horizontal does not exceed MAX_SPEED', () => {
    const b = new Body(0, '#4af')
    b.move(new THREE.Vector3(1000, 0, 0), 1)   // want absurdly much → hit the cap
    let d = new THREE.Vector3()
    for (let i = 0; i < 20; i++) { b.stepHorizontal(0.016, null); d = b.consumeDesired() }
    const speed = Math.hypot(d.x, d.z) / 0.016   // desired = velH·dt → recover the speed
    expect(speed).toBeLessThanOrEqual(MAX_SPEED + 1e-3)
    expect(speed).toBeGreaterThan(MOVE_SPEED)    // and still accelerated above the normal one
  })

  it('bhop: inertia survives landing (setGrounded does not kill horizontal)', () => {
    const b = new Body(0, '#4af')
    b.move(new THREE.Vector3(MOVE_SPEED, 0, 0), 1)
    for (let i = 0; i < 40; i++) b.stepHorizontal(0.016, null)   // accelerated on the ground
    b.consumeDesired()
    b.setGrounded(false)   // took off
    b.setGrounded(true)    // landed — velH is NOT zeroed
    b.move(new THREE.Vector3(MOVE_SPEED, 0, 0), 1)
    b.setJumpInput(true); b.stepJump()                     // bhop frame: friction is skipped
    b.stepHorizontal(0.016, null)
    expect(b.consumeDesired().x).toBeGreaterThan(0)        // speed preserved
  })

  it('stepVertical() accumulates falling into desired.y', () => {
    const b = new Body(0, '#4af')
    b.setGrounded(false)
    b.stepVertical(0.1)
    expect(b.velocityY).toBeLessThan(0)    // gravity pulls down
    expect(b.consumeDesired().y).toBeLessThan(0)
  })

  it('setGrounded(true) zeroes the vertical velocity', () => {
    const b = new Body(0, '#4af')
    b.setGrounded(false)
    b.velocityY = -5
    b.setGrounded(true)
    expect(b.velocityY).toBe(0)
  })

  it('setVisible() toggles the body mesh visibility', () => {
    const b = new Body(0, '#4af')
    b.setVisible(false)
    expect(b.mesh.visible).toBe(false)
    b.setVisible(true)
    expect(b.mesh.visible).toBe(true)
  })

  it('hitbox carries entityId and is marked invisible', () => {
    const b = new Body(7, '#4af')
    const hitbox = b.object3d.children[1] as THREE.Mesh
    expect(hitbox.userData.entityId).toBe(7)
    expect(hitbox.visible).toBe(false)
  })

  it('setHittable toggles the hitbox as a raycast target', () => {
    const b = new Body(0, '#4af')
    const hitbox = b.object3d.children[1] as THREE.Mesh
    expect(hitbox.userData.noRaycast).toBeFalsy()   // a target initially
    b.setHittable(false)
    expect(hitbox.userData.noRaycast).toBe(true)     // dead — not a target
    b.setHittable(true)
    expect(hitbox.userData.noRaycast).toBe(false)
  })

  it('dash() starts only if the cooldown is ready and dir≠0', () => {
    const b = new Body(0, '#4af')
    expect(b.dash(new THREE.Vector3(0, 0, 0))).toBe(false)   // no direction
    expect(b.dash(new THREE.Vector3(0, 0, -1))).toBe(true)   // ok
    expect(b.dash(new THREE.Vector3(1, 0, 0))).toBe(false)   // cooldown
  })

  it('stepDash() accumulates the dash into desired, dashing reflects the window', () => {
    const b = new Body(0, '#4af')
    b.dash(new THREE.Vector3(0, 0, -1))
    expect(b.dashing).toBe(true)
    b.stepDash(0.016)
    expect(b.consumeDesired().z).toBeLessThan(0)
  })

  it('dash accounts for the vertical: dash up moves desired.y up (not just horizontal)', () => {
    const b = new Body(0, '#4af')
    b.dash(new THREE.Vector3(0, 1, 0))   // straight up
    b.stepDash(0.016)
    expect(b.consumeDesired().y).toBeGreaterThan(0)
  })

  it('dashing=false after the window ends', () => {
    const b = new Body(0, '#4af')
    b.dash(new THREE.Vector3(0, 0, -1))
    const steps = Math.ceil(DASH_DURATION / 1000 / 0.016) + 2
    for (let i = 0; i < steps; i++) b.stepDash(0.016)
    expect(b.dashing).toBe(false)
  })

  it('dashProgress: 1 at rest, <1 during cooldown', () => {
    const b = new Body(0, '#4af')
    expect(b.dashProgress()).toBe(1)
    b.dash(new THREE.Vector3(0, 0, -1))
    expect(b.dashProgress()).toBeLessThan(1)
  })

  it('accepts art, setArt does not fail, dispose cleans up the texture', () => {
    const art = makeEmptyArt()
    art.front[8 * BALL_ART_SIZE + 8] = 1
    const b = new Body(1, '#4af', 'smooth', '#4af', art)
    expect(() => b.setArt(art)).not.toThrow()
    expect(() => b.setArt(null)).not.toThrow()
    expect(() => b.dispose()).not.toThrow()
  })
})
