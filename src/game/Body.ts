import * as THREE from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import type { MeshUserData } from '../utils/raycast'
import {
  EYE_HEIGHT, GRAVITY, JUMP_FORCE, BODY_MESH_Y, HITBOX_Y,
  DASH_SPEED, DASH_DURATION, DASH_COOLDOWN, KNOCKBACK_SPEED, KNOCKBACK_DURATION, KNOCKBACK_UP_SPEED, NET_REMOTE_LERP,
  BALL_RADIUS, BALL_SEGMENTS,
  MAX_AIR_JUMPS, GROUND_ACCEL, GROUND_FRICTION, AIR_ACCEL, AIR_WISH_SPEED, MAX_SPEED, SLOPE_MIN_NORMAL_Y,
} from '../constants'
import type { BallModel } from '../constants'
import { createBallMaterial, createBallRing } from './fx/ballMaterial'
import type { BallArt } from './ballArt'

type XYZ = { x: number; y: number; z: number }

// Scratch for facing the visual toward a direction (no per-frame allocations).
const _faceMat = new THREE.Matrix4()
const _faceUp = new THREE.Vector3(0, 1, 0)
const _faceOrigin = new THREE.Vector3(0, 0, 0)
const _faceTarget = new THREE.Vector3()
// Scratch for the movement step (no per-frame allocations).
const _wishDir = new THREE.Vector3()
const _knock = new THREE.Vector3()   // scratch: normalized 3D knockback direction

/**
 * Entity body. Position and collisions are owned by Rapier (kinematic RigidBody + KCC);
 * Body only ACCUMULATES movement intent (desired) and caches the position from rb. The sphere mesh is
 * the visual, the hitbox is the combat raycast target with entityId. Shared by player and bots.
 */
export class Body {
  readonly position = new THREE.Vector3(0, EYE_HEIGHT, 0)   // cache of rb.translation()
  readonly object3d = new THREE.Group()                     // local (origin) — RigidBody supplies the transform
  readonly mesh:     THREE.Mesh
  readonly material: THREE.MeshStandardMaterial

  rb: RapierRigidBody | null = null
  velocityY = 0
  grounded  = true
  justJumped = false   // jump applied this frame (for SFX); lives one frame (set in stepJump)

  private velH = new THREE.Vector3()        // persistent horizontal velocity (Quake inertia)
  private wishVel = new THREE.Vector3()     // desired velocity from input this frame (magnitude = wishspeed)
  private airJumps = 0                       // remaining air jumps (double jump)
  private jumpHeld = false                   // jump held (auto-bhop) — input this frame
  private prevJumpHeld = false               // for edge detection (new press) → air jump
  private jumpedThisFrame = false            // jumped this frame → skip friction (bhop)
  private desired = new THREE.Vector3()
  private teleport: THREE.Vector3 | null = null
  private netTarget: THREE.Vector3 | null = null   // target position of the remote player (client)
  private dashDir = new THREE.Vector3()
  private dashTimer = 0
  private dashCooldown = 0
  private knockDir = new THREE.Vector3()   // knockback impulse on overlapping another player (dash-like, but not a dash)
  private knockTimer = 0
  private shaderTick: (dt: number) => void
  private ballFx: ReturnType<typeof createBallMaterial>
  private ring: ReturnType<typeof createBallRing> | null = null

  constructor(entityId: number, color: string, model: BallModel = 'smooth', ringColor: string = color, art?: BallArt) {
    const ball = createBallMaterial(color, model, art)   // sphere material by model (smooth/waves/planet) + art
    this.ballFx = ball
    this.material = ball.material
    this.shaderTick = ball.tick
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, BALL_SEGMENTS, BALL_SEGMENTS), this.material)
    this.mesh.position.y = BODY_MESH_Y
    this.mesh.castShadow = true
    ;(this.mesh.userData as MeshUserData).noRaycast = true

    if (model === 'planet') {   // ring — child mesh of the sphere (scales/fades together with the planet)
      const ring = createBallRing(ringColor)   // "second" color (as in the menu); defaults to the ball color
      this.mesh.add(ring.mesh)
      this.ring = ring
    }

    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    hitbox.position.y = HITBOX_Y
    hitbox.visible = false
    ;(hitbox.userData as MeshUserData).entityId = entityId

    this.object3d.add(this.mesh, hitbox)
  }

  bindBody(rb: RapierRigidBody) {
    this.rb = rb
    this.desired.set(0, 0, 0)   // reset horizontal intent accumulated before physics was ready
    rb.setNextKinematicTranslation(this.position)   // leave velocityY alone — a jump during loading is preserved
  }
  unbind() { this.rb = null }

  /** Desired horizontal velocity this frame (NOT integrated immediately — stepHorizontal accumulates it via velH). */
  move(worldDir: THREE.Vector3, _dt: number) {
    this.wishVel.copy(worldDir)
  }

  /** Jump held this frame (held input): on the ground — auto-bhop, in the air — double jump on a new press. */
  setJumpInput(held: boolean) { this.jumpHeld = held }

  /** Jump handling (in Match.applyPhysics BEFORE stepVertical; grounded — from the previous frame). */
  stepJump() {
    this.jumpedThisFrame = false
    this.justJumped = false
    const edge = this.jumpHeld && !this.prevJumpHeld
    if (this.grounded && this.jumpHeld) {
      this.velocityY = JUMP_FORCE          // auto-bhop: hold jump → jump on every landing
      this.airJumps = MAX_AIR_JUMPS        // guarantee an air jump even on the first jump off spawn
      this.jumpedThisFrame = true
      this.justJumped = true
    } else if (edge && !this.grounded && this.airJumps > 0) {
      this.velocityY = JUMP_FORCE          // double jump — only on a NEW press in the air
      this.airJumps--
      this.justJumped = true
    }
    this.prevJumpHeld = this.jumpHeld
  }

  /** Accumulate the vertical (called from Match.applyPhysics before the KCC step). */
  stepVertical(dt: number) {
    this.velocityY += GRAVITY * dt
    this.desired.y += this.velocityY * dt
  }

  /**
   * Horizontal step (Quake): on the ground — friction (except on the jump frame → bhop) + fast accel toward
   * wishspeed and slope-following without speed loss; in the air — air-accelerate with a cap (strafe+mouse accel).
   * `groundNormal` — surface normal under the player (or null → flat). Accumulates the result into desired.
   */
  stepHorizontal(dt: number, groundNormal: THREE.Vector3 | null) {
    const wishspeed = this.wishVel.length()
    if (wishspeed > 1e-6) _wishDir.copy(this.wishVel).divideScalar(wishspeed)
    else _wishDir.set(0, 0, 0)

    if (this.grounded) {
      if (!this.jumpedThisFrame) this.velH.multiplyScalar(Math.max(0, 1 - GROUND_FRICTION * dt))
      if (wishspeed > 1e-6) this.accelerate(_wishDir, wishspeed, GROUND_ACCEL, dt)
      this.followSlope(groundNormal, dt)   // speed isn't eaten on the way up (Fix: slowdown on ramps)
    } else if (wishspeed > 1e-6) {
      this.accelerate(_wishDir, Math.min(wishspeed, AIR_WISH_SPEED), AIR_ACCEL, dt)
    }

    if (this.velH.lengthSq() > MAX_SPEED * MAX_SPEED) this.velH.setLength(MAX_SPEED)   // speed cap

    this.desired.x += this.velH.x * dt
    this.desired.z += this.velH.z * dt
  }

  /** Quake accelerate: adds speed along wishdir without exceeding wishspeed (only accelerates, never brakes). */
  private accelerate(wishdir: THREE.Vector3, wishspeed: number, accel: number, dt: number) {
    const current = this.velH.dot(wishdir)
    const add = wishspeed - current
    if (add <= 0) return
    const accelSpeed = Math.min(accel * wishspeed * dt, add)
    this.velH.addScaledVector(wishdir, accelSpeed)
  }

  /** On a slope, add a vertical component to desired so motion runs along the surface (v·n=0) —
   *  horizontal speed isn't lost going up/down. Flat/wall/no normal → nothing. */
  private followSlope(groundNormal: THREE.Vector3 | null, dt: number) {
    if (!groundNormal || groundNormal.y < SLOPE_MIN_NORMAL_Y) return
    const vy = -(groundNormal.x * this.velH.x + groundNormal.z * this.velH.z) / groundNormal.y
    this.desired.y += vy * dt
  }

  /** Instantly zero the dash cooldown (reward for ending a streak). */
  resetDashCooldown() { this.dashCooldown = 0 }

  /** Start a dash: true if the cooldown is ready and the direction is nonzero. Direction is 3D — the dash respects view pitch. */
  dash(dir: THREE.Vector3): boolean {
    if (this.dashCooldown > 0) return false
    this.dashDir.set(dir.x, dir.y, dir.z)
    if (this.dashDir.lengthSq() === 0) return false
    this.dashDir.normalize()
    this.dashTimer = DASH_DURATION
    this.dashCooldown = DASH_COOLDOWN
    return true
  }

  /** Accumulates the dash into desired and ticks the timers (called from Match.applyPhysics). */
  stepDash(dt: number) {
    if (this.dashCooldown > 0) this.dashCooldown -= dt * 1000
    if (this.dashTimer > 0) {
      this.desired.addScaledVector(this.dashDir, DASH_SPEED * dt)
      this.dashTimer -= dt * 1000
    }
  }

  get dashing() { return this.dashTimer > 0 }

  /** Knockback impulse along `dir` (3D, dash-like but not a dash): a strong push when players overlap.
   *  The horizontal share is a burst into desired (like a dash); the vertical (upward) is a velocityY impulse
   *  that overrides falling, so jumping on top of someone really launches you up in an arc. */
  knockback(dir: THREE.Vector3) {
    _knock.copy(dir)
    if (_knock.lengthSq() === 0) return
    _knock.normalize()
    // Horizontal part = horizontal projection of the unit vector (|.|≤1: the steeper the contact, the weaker the sideways push).
    this.knockDir.set(_knock.x, 0, _knock.z)
    this.knockTimer = KNOCKBACK_DURATION
    // Vertical part — upward impulse on top of current velocityY (Math.max → overrides falling, doesn't add up).
    if (_knock.y > 0) this.velocityY = Math.max(this.velocityY, _knock.y * KNOCKBACK_UP_SPEED)
  }

  /** Accumulates the knockback into desired and ticks the timer (called from Match.applyPhysics, like stepDash). */
  stepKnockback(dt: number) {
    if (this.knockTimer > 0) {
      this.desired.addScaledVector(this.knockDir, KNOCKBACK_SPEED * dt)
      this.knockTimer -= dt * 1000
    }
  }

  /** Whether the knockback window is currently active — so Match doesn't restart the impulse every overlap frame. */
  get knocking() { return this.knockTimer > 0 }

  /** Current horizontal speed (units/s) — for the speed overlay. */
  get horizontalSpeed() { return Math.hypot(this.velH.x, this.velH.z) }

  /** Dash readiness progress: 1 = ready, 0..1 during cooldown. */
  dashProgress(): number {
    return this.dashCooldown > 0 ? Math.max(0, 1 - this.dashCooldown / DASH_COOLDOWN) : 1
  }

  consumeDesired(out?: THREE.Vector3): THREE.Vector3 {
    const target = out ?? new THREE.Vector3()
    target.copy(this.desired)
    this.desired.set(0, 0, 0)
    return target
  }

  setGrounded(g: boolean) {
    this.grounded = g
    if (g) { this.velocityY = 0; this.airJumps = MAX_AIR_JUMPS }   // landed → restore air jumps
  }

  /** Full stop (ready/countdown/match-end freeze): kill inertia and intent. */
  halt() {
    this.velH.set(0, 0, 0)
    this.wishVel.set(0, 0, 0)
    this.velocityY = 0
  }

  setPosition(p: THREE.Vector3) {
    this.position.copy(p)
    this.velocityY = 0
    this.velH.set(0, 0, 0)        // respawn/teleport — don't carry inertia over
    this.wishVel.set(0, 0, 0)
    this.grounded = p.y <= EYE_HEIGHT + 0.01
    this.teleport = p.clone()
    this.netTarget = null   // respawn/teleport — the old authority is invalid
    this.dashTimer = 0
    this.dashCooldown = 0
  }
  consumeTeleport(): THREE.Vector3 | null {
    const t = this.teleport
    this.teleport = null
    return t
  }

  // --- networking: remote player position (client renders from snapshots) ---
  applyNetTarget(pos: THREE.Vector3) {
    if (this.netTarget) this.netTarget.copy(pos)
    else this.netTarget = pos.clone()
  }
  hasNetTarget() { return this.netTarget !== null }
  /** Next position: smooth step from current (rb/cache) toward the network target. */
  nextRemoteTranslation(): XYZ {
    const cur = this.rb ? this.rb.translation() : this.position
    const t = this.netTarget ?? this.position
    return {
      x: THREE.MathUtils.lerp(cur.x, t.x, NET_REMOTE_LERP),
      y: THREE.MathUtils.lerp(cur.y, t.y, NET_REMOTE_LERP),
      z: THREE.MathUtils.lerp(cur.z, t.z, NET_REMOTE_LERP),
    }
  }

  /** Cache the position from the physics body (result of the previous step). */
  syncFromBody() {
    if (!this.rb) return
    const t = this.rb.translation()
    this.position.set(t.x, t.y, t.z)
  }

  setVisible(v: boolean) { this.mesh.visible = v }

  /**
   * Faces the visual sphere along the aim direction — YAW ONLY (horizontal):
   * the model stays upright, no pitch/roll tilt when looking up/down. Only the mesh rotates
   * (sphere + planet ring); the hitbox is left alone — combat stays stable.
   */
  faceDir(dir: THREE.Vector3) {
    _faceTarget.set(dir.x, 0, dir.z)   // project onto horizontal → pure yaw, no tilt
    if (_faceTarget.lengthSq() < 1e-8) return   // aim nearly vertical — leave orientation alone
    _faceMat.lookAt(_faceOrigin, _faceTarget, _faceUp)
    this.mesh.quaternion.setFromRotationMatrix(_faceMat)
  }

  /** Advances the model's shader time (waves / ring drift). For smooth — no-op. */
  tickShader(dt: number) { this.shaderTick(dt); this.ring?.tick(dt) }

  /** Update the ball's art in place (live preview in the menu; without recreating the material). */
  setArt(art: BallArt | null) { this.ballFx.setArt(art) }

  /** Visual opacity (ghost/materialize): sphere + ring. */
  setOpacity(o: number) { this.material.opacity = o; this.ring?.setOpacity(o) }

  // --- planet ring: access for the menu preview (live "second" color change, glow layer) ---
  /** Planet ring mesh; null for models without a ring. */
  get ringMesh() { return this.ring?.mesh ?? null }
  /** Smooth ring color change (no-op for models without a ring). */
  lerpRingColor(c: THREE.Color, t: number) { this.ring?.lerpColor(c, t) }
  /** Instantly set the ring color. */
  setRingColor(c: THREE.Color) { this.ring?.setColor(c) }

  /** Toggle the hitbox as a raycast target: a dead/deflating ball can't be shot again. */
  setHittable(v: boolean) {
    const hitbox = this.object3d.children[1] as THREE.Mesh
    ;(hitbox.userData as MeshUserData).noRaycast = !v
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.ballFx.dispose()        // art texture
    this.ring?.dispose()
    const hb = this.object3d.children[1] as THREE.Mesh
    hb.geometry.dispose()
    ;(hb.material as THREE.Material).dispose()
  }
}
