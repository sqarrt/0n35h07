import * as THREE from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import type { IControllable, IWeapon, IShield, IDashTrail } from './abstractions'
import type { World } from './World'
import { Body } from './Body'
import { overheatMods } from './overheat'
import { AfterimageTrail } from './fx/AfterimageTrail'
import { toVec3, fromVec3 } from '../net/protocol'
import type { PlayerSnapshot } from '../net/protocol'
import {
  MUZZLE_Y, BODY_MESH_Y, BALL_RADIUS, EYE_HEIGHT, WINDUP_SHRINK_MS,
  RESPAWN_GHOST_MS, RESPAWN_SPEED_MULT, RESPAWN_SPEED_RAMP,
} from '../constants'
import type { WindupStyle, RespawnStyle, DashStyle } from '../constants'
import { ClassicWindupFx } from './fx/windup/ClassicWindupFx'
import type { IWindupFx, WindupTarget, WindupFrame } from './fx/windup/types'
import { EchoRespawnFx } from './fx/respawn/EchoRespawnFx'
import type { IRespawnFx, RespawnTarget, RespawnFrame } from './fx/respawn/types'

const REMOTE_AIM = new THREE.Vector3(0, 0, -1)   // dummy aim for the cosmetic weapon.update of a remote player

/**
 * Single player entity — human, bot, and network player alike. Composes a body, weapon and
 * shield (injected → DIP). Controllers drive the intent methods. Never respawns itself.
 *
 * Scene graph: bodyGroup (body + hitbox + shield) goes inside <RigidBody> (transform comes
 * from Rapier); the beam (weaponObject) is world-space, rendered in match.beams.
 */
const _renderScratch = new THREE.Vector3()   // scratch for renderInterpolate (single-threaded → safe)

export class Player implements IControllable {
  alive = true
  respawning = false   // ghost phase: invulnerable, moves ×3, doesn't attack
  respawnTimer = 0     // remaining ghost phase (ms)
  name = ''            // display name (You / Bot N) — set by Match
  team = 0             // team from the mode preset (teamOfSlot) — set by Match; same team → no harm
  private nameplate: THREE.Sprite | null = null   // billboard name over remotes (2v2/FFA); hides with the body
  kills = 0            // session score (not reset on respawn)
  deaths = 0
  streak = 0           // consecutive kills without dying (for streak announces); reset on death
  readonly id: number
  readonly bodyGroup = new THREE.Group()
  readonly spawn = new THREE.Vector3(0, EYE_HEIGHT, 0)

  private body: Body
  private weapon: IWeapon
  private shield: IShield
  private trail: IDashTrail   // styled DASH trail (dashStyle skin); the ghost trail is drawn by respawnFx
  private aimPoint = new THREE.Vector3(0, EYE_HEIGHT, -100)
  private aimOrigin = new THREE.Vector3()          // origin of the HIT ray (human's camera); valid when hasAimOrigin
  private hasAimOrigin = false                     // is the aim origin set (human) — otherwise hit from the muzzle (bot/remote)
  private lookDir = new THREE.Vector3(0, 0, -1)   // LOOK direction (model orientation): stable, independent
  //                                                 of the aim point distance (in TP the camera is behind → aimPoint−muzzle flipped)
  private spawnTime = -Infinity   // moment materialization began (respawn)
  private bodyMeshOffset = new THREE.Vector3(0, BODY_MESH_Y, 0)   // sphere center relative to the eyes
  private bodyVisible = true
  private moveScale = 1            // speed multiplier from OVERHEAT
  // Scratch vectors — reused each frame instead of new THREE.Vector3() in the hot path.
  private _muzzle      = new THREE.Vector3()
  private _aimDir      = new THREE.Vector3()
  private _hitDir      = new THREE.Vector3()
  private _moveScaled  = new THREE.Vector3()
  private _deathPos    = new THREE.Vector3()
  pierceWalls = false              // PIERCE (SINGULARITY mode): the beam ignores map blocks; set by Match
  private frozen = false   // readiness/countdown before the fight — intents suppressed
  private fireTime = -Infinity
  private baseColor: THREE.Color
  readonly windupStyle: WindupStyle
  private windupFx: IWindupFx
  private windupTarget: WindupTarget
  private windupFrame: WindupFrame
  readonly respawnStyle: RespawnStyle
  readonly dashStyle: DashStyle
  private respawnFx: IRespawnFx
  private respawnTarget: RespawnTarget
  private respawnFrame: RespawnFrame
  // Network state for rendering a remote player on the client (without running its sim).
  private netShieldActive = false
  private netDashing = false
  private netWindup = 0
  private prevNetWindup = 0
  private netFireTime = -Infinity   // remote player's fire moment (netWindup 1→0 edge) — for smooth deflation
  private netAimDir = new THREE.Vector3(0, 0, -1)   // remote look direction (from snapshot) — for model orientation

  constructor(
    id: number,
    body: Body,
    weapon: IWeapon,
    shield: IShield,
    color: string,
    windupFx: IWindupFx = new ClassicWindupFx(),
    windupStyle: WindupStyle = 'classic',
    respawnFx: IRespawnFx = new EchoRespawnFx(color),
    respawnStyle: RespawnStyle = 'echo',
    dashFx: IDashTrail = new AfterimageTrail(new THREE.Color(color)),
    dashStyle: DashStyle = 'streak',
  ) {
    this.id = id
    this.body = body
    this.weapon = weapon
    this.shield = shield
    this.baseColor = new THREE.Color(color)
    this.windupFx = windupFx
    this.windupStyle = windupStyle
    this.windupTarget = { mesh: body.mesh, material: body.material }
    this.windupFrame = {
      progress: 0, shrink: 1, baseColor: this.baseColor,
      aimDir: new THREE.Vector3(0, 0, -1), origin: new THREE.Vector3(), visible: true,
    }
    this.respawnFx = respawnFx
    this.respawnStyle = respawnStyle
    this.respawnTarget = { mesh: body.mesh, material: body.material, setOpacity: (o: number) => body.setOpacity(o) }
    this.respawnFrame = {
      ghost: null, sinceRebirthMs: Infinity, baseColor: this.baseColor,
      origin: new THREE.Vector3(), visible: true,
    }
    this.trail = dashFx   // world-space dash-trail visual — Match places it in root
    this.dashStyle = dashStyle
    shield.object3d.position.set(0, BODY_MESH_Y, 0)   // local — rides with the body
    this.bodyGroup.add(body.object3d, shield.object3d)
    // Stable reference for ref={p.bindBody}: otherwise an inline ref re-binds
    // every frame (App re-renders on HUD) and breaks bound → double hitbox transform.
    this.bindBody = this.bindBody.bind(this)
  }

  /** The beam — world-space, rendered separately (outside RigidBody). */
  get weaponObject() { return this.weapon.object3d }

  /** The dash trail — also world-space (lives in match.root, not in RigidBody). */
  get trailObject() { return this.trail.object3d }

  /** World part of the respawn animation (shards/particles) — lives in match.root, like trail/windupFx. */
  get respawnFxObject() { return this.respawnFx.object3d }

  /** World-space part of the windup animation (jaws/vortex) — lives in match.root, like trail/burst. */
  get windupFxObject() { return this.windupFx.object3d }

  // --- Rapier binding (RigidBody = collider only; visual is separate in world-space) ---
  bindBody(rb: RapierRigidBody | null) {
    if (!rb) { this.body.unbind(); return }
    this.body.bindBody(rb)
  }
  get rb() { return this.body.rb }
  consumeDesired(out?: THREE.Vector3) { return this.body.consumeDesired(out) }
  consumeTeleport()       { return this.body.consumeTeleport() }
  stepJump()              { this.body.stepJump() }
  stepVertical(dt: number){ this.body.stepVertical(dt) }
  stepHorizontal(dt: number, groundNormal: THREE.Vector3 | null) { this.body.stepHorizontal(dt, groundNormal) }
  stepDash(dt: number)    { this.body.stepDash(dt) }
  get dashing()           { return this.body.dashing }
  knockback(dir: THREE.Vector3) { this.body.knockback(dir) }
  stepKnockback(dt: number)     { this.body.stepKnockback(dt) }
  get knocking()          { return this.body.knocking }
  get grounded()          { return this.body.grounded }
  get justJumped()        { return this.body.justJumped }
  get speed()             { return this.body.horizontalSpeed }   // horizontal speed (overlay)
  setGrounded(g: boolean) { this.body.setGrounded(g) }

  /** Cache the position from the physics body and move the visual group (it's in world-space). */
  syncFromBody() {
    this.body.syncFromBody()
    this.bodyGroup.position.copy(this.body.position)   // combat hitboxes (under bodyGroup) use the SIM position each tick
  }

  /** Snapshot the sim position this tick (render interpolation). Called by the driver after each fixed step. */
  captureTick() { this.body.captureTick() }

  /** Interpolated render position lerp(prevTick, curTick, alpha) — used by the camera (local player). */
  renderPos(alpha: number, out: THREE.Vector3): THREE.Vector3 { return this.body.renderPos(alpha, out) }

  /** Movement-state snapshot/restore for client prediction replay (host fills the snapshot; client restores). */
  saveBodyState() { return this.body.saveState() }
  restoreBodyState(s: import('./Body').BodyState) { this.body.restoreState(s) }

  /** The host-tick this (remote) player is being rendered at — stamped on a fire for lag compensation. */

  /** Render error-decay (anti-pop after a correction): decay each frame; commit eases the visual from predicted→corrected. */
  decayRenderError() { this.body.decayRenderError() }
  commitCorrection(predX: number, predY: number, predZ: number) { this.body.commitCorrection(predX, predY, predZ) }

  /** Render-frame visual placement: bodyGroup = lerp(prevTick, curTick, alpha). Runs AFTER the tick loop, so it's
   *  the last write before R3F draws; the next tick's syncFromBody resets bodyGroup to the sim position for combat. */
  renderInterpolate(alpha: number) { this.bodyGroup.position.copy(this.body.renderPos(alpha, _renderScratch)) }

  /** Freeze: during readiness/countdown/end, movement and actions are off, camera/aim are not.
   *  Enabling it kills inertia (velH/velocityY) → players really stand still (match-end freeze-frame). */
  setFrozen(v: boolean) { this.frozen = v; if (v) this.body.halt() }

  // --- IControllable ---
  // Movement is available to the living AND the ghost (respawn phase, ×3 speed); attacking — only the living.
  private canMove() { return !this.frozen && (this.alive || this.respawning) }
  private canAct()  { return !this.frozen && this.alive }
  moveIntent(dir: THREE.Vector3, dt: number) {
    if (!this.canMove()) return
    const base = this.respawning ? this.respawnSpeedMult() : 1
    const m = base * this.moveScale
    this.body.move(m === 1 ? dir : this._moveScaled.copy(dir).multiplyScalar(m), dt)
  }

  /** Apply OVERHEAT for the current streak: speed + beam/shield cooldowns. */
  applyOverheat() {
    const o = overheatMods(this.streak)
    this.moveScale = o.speed
    this.weapon.setCooldownScale(o.beamCd)
    this.shield.setCooldownScale(o.shieldCd)
  }
  /** Reward for breaking a streak: instantly reset beam/shield/dash cooldowns. */
  resetCooldowns() {
    this.weapon.resetCooldown()
    this.shield.resetCooldown()
    this.body.resetDashCooldown()
  }
  /** Overheated to the "through walls" level (SINGULARITY). */
  get seeThrough() { return overheatMods(this.streak).seeThrough }

  /** Speed multiplier in the ghost phase: full ×N, smoothly decaying to ×1 over the last RESPAWN_SPEED_RAMP. */
  private respawnSpeedMult(): number {
    const p = this.respawnTimer / RESPAWN_GHOST_MS   // 1→0
    if (p >= RESPAWN_SPEED_RAMP) return RESPAWN_SPEED_MULT
    return 1 + (RESPAWN_SPEED_MULT - 1) * (p / RESPAWN_SPEED_RAMP)
  }
  setJumpInput(held: boolean)  { this.body.setJumpInput(this.canMove() && held) }   // held → auto-bhop/double jump
  // Aim AT a world POINT (available even while frozen). origin (human's camera) → the hit is computed along the
  // aim ray camera→point, not from the muzzle: removes parallax in TP. Without origin (bot/remote) — hit from the muzzle.
  aim(point: THREE.Vector3, origin?: THREE.Vector3) {
    this.aimPoint.copy(point)
    this.hasAimOrigin = origin !== undefined
    if (origin) this.aimOrigin.copy(origin)
  }
  /** Look direction (for model orientation). faceDir takes its horizontal projection; near-zero vector is ignored. */
  setLook(dir: THREE.Vector3)  { if (dir.lengthSq() > 1e-8) this.lookDir.copy(dir) }
  startFiring()                { if (!this.canAct()) return; this.weapon.beginWindup() }
  cancelFiring()               { if (!this.canAct()) return; this.weapon.interrupt() }
  activateShield()             { if (!this.canAct()) return; this.shield.activate() }
  dash(dir: THREE.Vector3) {
    if (!this.canAct()) return
    if (dir.lengthSq() === 0) return
    if (!this.body.dash(dir)) return   // on cooldown — don't touch the windup
    this.weapon.interrupt()            // a successful dash cancels the windup
  }

  // --- simulation (no position integration — Rapier KCC does it in Match.applyPhysics) ---
  update(dt: number, world: World, excludeIds: number[]) {
    this._muzzle.copy(this.body.position); this._muzzle.y += MUZZLE_Y   // sphere center
    const aim = this._aimDir.copy(this.aimPoint).sub(this._muzzle).normalize()
    this._muzzle.addScaledVector(aim, BALL_RADIUS)   // muzzle on the sphere surface, ⊥ to it
    this.body.faceDir(this.lookDir)   // model orients by LOOK (not by the aim point — otherwise yaw jumps in TP)
    // Human's hit — along the aim ray (camera→point); bot/remote have no origin → hit from the muzzle.
    const hitOrigin = this.hasAimOrigin ? this.aimOrigin : undefined
    const hitDir = this.hasAimOrigin ? this._hitDir.copy(this.aimPoint).sub(this.aimOrigin).normalize() : undefined
    this.weapon.update(dt, { world, muzzle: this._muzzle, aim, excludeIds, pierceWalls: this.pierceWalls, hitOrigin, hitDir })
    this.shield.update(dt)
    this.syncVisuals(dt)
    this.trail.update(dt, { position: this.body.position, dashing: this.body.dashing })
    this.respawnFx.update(dt)   // the ghost trail is drawn by the respawn strategy itself (inside apply)
    this.body.tickShader(dt)
  }

  /** Visual tick in the ghost phase. true → the caller should return early. */
  private applyGhostVisuals(dt: number): boolean {
    if (!this.respawning) return false
    this.shield.object3d.visible = false
    this.windupFx.object3d.visible = false
    this.applyRespawn(dt)
    return true
  }

  private syncVisuals(dt: number) {
    if (!this.bodyVisible) this.shield.object3d.visible = false   // don't draw the bubble in FP
    if (this.weapon.justFired) this.fireTime = Date.now()
    if (this.applyGhostVisuals(dt)) return
    this.body.setOpacity(1)   // normal state; the rebirth window below overrides it
    this.applyWindup(dt, this.weapon.windupProgress, this.fireTime, this.lookDir)
    this.applyRespawn(dt)     // the rebirth window beats the windup scale (like the old "poof"); otherwise no-op
    if (this.respawnFx.isRebirthActive(Date.now() - this.spawnTime)) this.shield.object3d.visible = false
  }

  /** Shared respawn animation path (ghost/rebirth) for the local and network player. */
  private applyRespawn(dt: number) {
    const f = this.respawnFrame
    f.ghost = this.respawning ? this.respawnProgress() : null
    f.sinceRebirthMs = Date.now() - this.spawnTime
    f.origin.copy(this.body.position).add(this.bodyMeshOffset)
    f.visible = this.bodyVisible
    this.respawnFx.apply(dt, this.respawnTarget, f)
  }

  /** Shared windup animation path for the local (weapon/lookDir) and network (netWindup/netAimDir) player. */
  private applyWindup(dt: number, progress: number, fireTime: number, aimDir: THREE.Vector3) {
    const f = this.windupFrame
    f.progress = progress
    f.shrink = Math.min((Date.now() - fireTime) / WINDUP_SHRINK_MS, 1)
    f.aimDir.copy(aimDir)
    f.origin.copy(this.body.position).add(this.bodyMeshOffset)
    f.visible = this.bodyVisible
    this.windupFx.apply(dt, this.windupTarget, f)
  }

  // --- combat (driven by Match, never self-respawn) ---
  receiveHit(): 'blocked' | 'killed' {
    if (!this.alive) return 'blocked'        // already dead/ghost — don't finish off (no double kill)
    if (this.shield.isActive) return 'blocked'
    this.alive = false
    if (this.nameplate) this.nameplate.visible = false   // the plate dies with the body
    this.startGhost()
    return 'killed'
  }

  /** Attach/replace the name plate (2v2/FFA remotes). null removes it. Visibility follows alive/respawn. */
  setNameplate(sprite: THREE.Sprite | null) {
    if (this.nameplate) this.bodyGroup.remove(this.nameplate)
    this.nameplate = sprite
    if (sprite) this.bodyGroup.add(sprite)
  }

  /** Start of the ghost phase: invulnerability, particle burst, timer until materialization. */
  private startGhost() {
    this.respawning = true
    this.respawnTimer = RESPAWN_GHOST_MS
    this.body.setHittable(false)
    this.weapon.interrupt()   // cancel the unfinished windup — the ghost doesn't fire it off
    if (this.bodyVisible) this.respawnFx.onDeath(this._deathPos.copy(this.body.position).add(this.bodyMeshOffset))
  }

  /** Client: undo a falsely predicted death (the host rejected the claim — block or a lost claim). The opponent never
   *  actually died, so no teleport/cooldown reset/rebirth poof — just leave the ghost phase and restore the hitbox
   *  (startGhost set it noRaycast; respawnAt won't run — a real 'respawn' event only follows a real death). */
  reviveFromFalsePrediction() {
    if (this.alive) return
    this.alive = true
    this.respawning = false
    this.respawnTimer = 0
    this.body.setHittable(true)
  }

  /** Client: tick the phase timer locally (for indication/speed); the finale comes via the respawn event. */
  tickRespawn(dt: number) {
    if (this.respawning) this.respawnTimer = Math.max(0, this.respawnTimer - dt * 1000)
  }

  /** Materialize where movement stopped (end of the ghost phase). pos — authoritative position.
   *  ALL cooldowns reset: beam (weapon.reset), shield (shield.reset), dash (body.setPosition zeroes the cooldown). */
  respawnAt(pos: THREE.Vector3) {
    this.spawn.copy(pos)
    this.body.setPosition(pos)   // teleport + dash cooldown reset
    this.weapon.reset()          // beam cooldown reset
    this.shield.reset()          // shield cooldown reset
    this.alive = true
    this.respawning = false
    this.spawnTime = Date.now()        // short springy "poof"
    this.respawnTimer = 0
    this.body.setHittable(true)
    this.body.material.color.copy(this.baseColor)
    if (this.nameplate) this.nameplate.visible = true   // reborn → the plate is back
  }

  setBodyVisible(v: boolean) {
    this.bodyVisible = v
    this.body.setVisible(v)
    this.trail.object3d.visible = v   // don't show our own trail in FP (camera inside the body)
  }
  spawnImpact(point: THREE.Vector3) { this.weapon.spawnImpact(point) }

  /** Demo replay: hard-set the visual position (no physics/Rapier — we drive bodyGroup ourselves). */
  setReplayPose(pos: THREE.Vector3) {
    this.body.position.copy(pos)
    this.bodyGroup.position.copy(pos)
  }

  // --- getters for Match / HUD / debug ---
  get position()            { return this.body.position }
  get isWindingUp()         { return this.weapon.isWindingUp }
  get windupProgress()      { return this.weapon.windupProgress }
  beamCooldownProgress()    { return this.weapon.cooldownProgress() }
  dashCooldownProgress()    { return this.body.dashProgress() }
  shieldProgress()          { return this.shield.progress() }
  get shieldActive()        { return this.shield.isActive }
  /** Perfect block: shield activated in the window before a hit — grounds for resetting cooldowns. */
  get perfectBlock()        { return this.shield.isPerfectBlock() }
  get weaponJustFired()     { return this.weapon.justFired }
  get fireOutcome()         { return this.weapon.outcome }
  clearJustFired()          { this.weapon.clearJustFired() }

  // --- networking (host-authoritative) ---
  get color() { return this.baseColor }

  /** State snapshot for broadcast (host). */
  serializeState(): PlayerSnapshot {
    return {
      id: this.id,
      pos: toVec3(this.body.position),
      aimDir: toVec3(this.lookDir),   // look direction (opponent's model orientation); steadier than the aim point
      alive: this.alive,
      shieldActive: this.shieldActive,
      dashing: this.dashing,
      windupProgress: this.windupProgress,
      respawning: this.respawning,
    }
  }

  /** Fills a pre-alloc snapshot in-place (no Vec3/object allocations). */
  fillState(out: PlayerSnapshot): void {
    const p = this.body.position
    out.pos[0] = p.x; out.pos[1] = p.y; out.pos[2] = p.z
    out.aimDir[0] = this.lookDir.x; out.aimDir[1] = this.lookDir.y; out.aimDir[2] = this.lookDir.z
    out.alive = this.alive; out.shieldActive = this.shieldActive
    out.dashing = this.dashing; out.windupProgress = this.windupProgress
    out.respawning = this.respawning
  }

  /** Apply a snapshot to a remote player (client): position target + visual flags. */
  applyNetState(snap: PlayerSnapshot, hostTick: number = 0) {
    this.body.applyNetTarget(fromVec3(snap.pos), hostTick)
    this.alive = snap.alive
    this.respawning = snap.respawning
    this.netAimDir.copy(fromVec3(snap.aimDir))
    this.netShieldActive = snap.shieldActive
    this.netDashing = snap.dashing
    // Windup was there and vanished → a shot: start the local smooth deflation animation.
    if (this.prevNetWindup > 0.5 && snap.windupProgress === 0) this.netFireTime = Date.now()
    this.prevNetWindup = snap.windupProgress
    this.netWindup = snap.windupProgress
  }

  hasNetTarget() { return this.body.hasNetTarget() }
  nextRemoteTranslation() { return this.body.nextRemoteTranslation() }
  // NOTE: the local player on a client is reconciled by Match.ClientReconciler (prediction error vs ackSeq),
  // not by a per-frame pull — so there is no setAuthoritative/reconcileLocal here anymore.
  get bodyScale() { return this.body.mesh.scale.x }   // debug: current sphere scale
  get bodyIsVisible() { return this.bodyVisible }     // FP=false (body hidden) / TP/opponent=true
  get isRespawning() { return this.respawning }
  /** Client view of a REMOTE's shield (from snapshots). The local sim shield (`shieldActive`) isn't driven for
   *  opponents, so kill prediction must gate on THIS — don't predict a death through a visibly raised shield. */
  get netShielding() { return this.netShieldActive }
  /** Client view of a REMOTE's dash (from snapshots) — the local sim dash flag isn't driven for opponents. */
  get remoteDashing() { return this.netDashing }
  respawnProgress() { return Math.max(0, this.respawnTimer / RESPAWN_GHOST_MS) }   // 1→0 phase remainder

  /** Cosmetic remote shot (client, FIRED event). */
  cosmeticFire(end: THREE.Vector3, hitPoint: THREE.Vector3 | null) {
    this._muzzle.copy(this.body.position); this._muzzle.y += MUZZLE_Y   // sphere center
    this._aimDir.copy(end).sub(this._muzzle).normalize()                // direction toward the beam end
    this._muzzle.addScaledVector(this._aimDir, BALL_RADIUS)             // muzzle on the sphere surface
    this.weapon.playBeam(this._muzzle, end, hitPoint)
  }

  /** Remote death on a KILL event (client): the authority already decided, we don't check the shield. */
  applyDeath() {
    if (!this.alive) return
    this.alive = false
    this.startGhost()
  }

  /** Remote player's frame on the client: cosmetics only, no combat/physics. */
  updateRemote(dt: number, world: World) {
    // The weapon phase stays idle (we don't call beginWindup) → weapon.update only renders the beam.
    this._muzzle.copy(this.body.position); this._muzzle.y += MUZZLE_Y
    this.weapon.update(dt, { world, muzzle: this._muzzle, aim: REMOTE_AIM, excludeIds: [this.id] })
    this.body.faceDir(this.netAimDir)   // the remote model looks along its aim (from the snapshot)
    this.trail.update(dt, { position: this.body.position, dashing: this.netDashing })
    // Tick the shield for the skin animation: the remote's phases are always idle (activate not called),
    // and the group visibility is forced below in applyRemoteVisual from the snapshot — the skin sees it as active.
    this.shield.update(dt)
    this.respawnFx.update(dt)
    this.body.tickShader(dt)
    this.applyRemoteVisual(dt)
  }

  private applyRemoteVisual(dt: number) {
    if (this.applyGhostVisuals(dt)) return
    this.body.setOpacity(1)
    // Order as in syncVisuals: windup first, then the rebirth window overrides the scale on top.
    this.applyWindup(dt, this.netWindup, this.netFireTime, this.netAimDir)
    this.applyRespawn(dt)
    const rebirth = this.respawnFx.isRebirthActive(Date.now() - this.spawnTime)
    this.shield.object3d.visible = this.netShieldActive && this.bodyVisible && !rebirth
  }

  dispose() {
    this.weapon.dispose()
    this.shield.dispose()
    this.body.dispose()
    this.trail.dispose()
    this.respawnFx.dispose()
    this.windupFx.dispose()
  }
}
