import * as THREE from 'three'
import type { Controller } from '../abstractions'
import type { Player } from '../Player'
import type { World } from '../World'
import { horizontalBasis, moveVelocity, dashDirection } from './movement'
import type { MoveKeys } from './movement'
import { toVec3 } from '../../net/protocol'
import type { InputFrame } from '../../net/protocol'
import {
  WINDUP_LOOK_FACTOR, TP_DIST, TP_HEIGHT, TP_SHOULDER_X, DASH_FOV, AIM_RANGE,
} from '../../constants'

type Keys = MoveKeys & { jump: boolean }   // + held jump (auto-bhop), processed per frame

/** Minimal controls interface (drei PointerLockControls): we use only pointerSpeed. */
export interface PointerControls { pointerSpeed: number }

/** Human: keys/mouse/camera → the same Player intent-methods as the bot. */
export class HumanController implements Controller {
  private thirdPerson = false
  private shakeFrames = 0
  private fov = 75
  // Scratch vectors: tmp — general-purpose scratch (getWorldDirection); the rest are per-purpose.
  private tmp          = new THREE.Vector3()
  private _camPos      = new THREE.Vector3()   // scratch: interpolated local position for the camera
  private _dir         = new THREE.Vector3()
  private _right       = new THREE.Vector3()
  private _basis       = { dir: this._dir, right: this._right }
  private _vel         = new THREE.Vector3()
  private _aimFallback = new THREE.Vector3()

  private player: Player
  private camera: THREE.PerspectiveCamera
  private keys: React.MutableRefObject<Keys>
  private controls: React.RefObject<PointerControls | null>
  private world: World
  // Edge actions per frame — for the network InputFrame (client sends to host). Jump is held (see keys.jump).
  private pending = { fire: false, shield: false, dash: false }

  constructor(
    player: Player,
    camera: THREE.PerspectiveCamera,
    keys: React.MutableRefObject<Keys>,
    controls: React.RefObject<PointerControls | null>,
    world: World,
    startThirdPerson = false,
  ) {
    this.player = player
    this.camera = camera
    this.keys = keys
    this.controls = controls
    this.world = world
    this.thirdPerson = startThirdPerson
    player.setBodyVisible(startThirdPerson)   // starting view from setting (FP hides the model)
  }

  // --- edge events from DOM (invoked by host) ---
  onFire()    { if (document.pointerLockElement) { this.player.startFiring();    this.pending.fire = true } }
  onShield()  { if (document.pointerLockElement) { this.player.activateShield(); this.pending.shield = true } }
  onDash() {
    if (!document.pointerLockElement) return
    this.pending.dash = true
    const world = this.camera.getWorldDirection(this.tmp)      // full look dir (with pitch); already normalized
    horizontalBasis(world, this._basis)                        // strafe axis is horizontal; tmp unchanged
    const d = dashDirection(this.keys.current, world, this._right)   // world is not mutated in dashDirection
    if (d) this.player.dash(d)
  }
  shake()     { this.shakeFrames = 5 }
  toggleView() {
    this.thirdPerson = !this.thirdPerson
    this.player.setBodyVisible(this.thirdPerson)
  }

  /** Camera-relative horizontal axes (for movement and dash direction). */
  private basis() {
    return horizontalBasis(this.camera.getWorldDirection(this.tmp), this._basis)
  }

  /** Build the input frame to send to the host (client). Clears the edge latches. */
  currentInputFrame(tick: number): InputFrame {
    const k = this.keys.current
    const look = this.camera.getWorldDirection(this.tmp)
    const frame: InputFrame = {
      tick,
      keys: { f: k.forward, b: k.back, l: k.left, r: k.right },
      aimDir: toVec3(look),
      aimOrigin: toVec3(this.camera.position),   // aim origin = camera (in TP offset behind) — so the host replays the same ray
      jump: k.jump,   // held state (not an edge) — auto-bhop/double jump is computed by Body on the host
      fire: this.pending.fire,
      shield: this.pending.shield, dash: this.pending.dash,
    }
    this.pending = { fire: false, shield: false, dash: false }
    return frame
  }

  // --- intents (before physics) ---
  update(dt: number) {
    // Menu open (pointer not locked) — player doesn't move or aim, reset jump (no stuck bhop).
    if (!document.pointerLockElement) { this.player.setJumpInput(false); return }
    const { dir, right } = this.basis()   // fills _dir/_right; this.tmp = camera direction
    this.player.moveIntent(moveVelocity(this.keys.current, dir, right, this.player.isWindingUp, this._vel), dt)
    this.player.setJumpInput(this.keys.current.jump)   // held → auto-bhop/double jump (Body decides)

    // this.tmp already holds the camera direction from basis() — no need to call getWorldDirection again.
    this.player.setLook(this.tmp)
    // In SINGULARITY mode the aim ray also shoots through blocks — otherwise in TP aimPoint hits
    // the near wall and the ray flies into it instead of through walls into the opponent.
    const hit = this.world.raycast(this.camera.position, this.tmp, [this.player.id], this.player.pierceWalls)
    const aimPoint = hit
      ? hit.point
      : this._aimFallback.copy(this.camera.position).addScaledVector(this.tmp, AIM_RANGE)
    // In TP the hit uses the aim ray camera→point (beam visual comes from the muzzle): removes muzzle↔camera parallax
    // (bot in a pit/pool). In FP camera ≈ muzzle — keep the hit from the muzzle (familiar feel, hit chance unchanged).
    this.player.aim(aimPoint, this.thirdPerson ? this.camera.position : undefined)
  }

  // --- camera/view (after physics) ---
  /** Per RENDER frame: place the camera from the local player's INTERPOLATED position (smooth at any refresh).
   *  Position + shake live here (not in lateUpdate) so they aren't quantised to the fixed tick. */
  renderCamera(alpha: number) {
    const pos = this.player.renderPos(alpha, this._camPos)
    if (this.thirdPerson) {
      // getWorldDirection forces a matrixWorld update; after that the matrix columns are current.
      this.camera.getWorldDirection(this.tmp)   // tmp = camera forward (with pitch)
      const m = this.camera.matrixWorld.elements
      // Offset the camera along its LOCAL axes: m[0..2] = right, m[4..6] = up.
      // The model always projects to the same screen spot at any pitch and yaw.
      this.camera.position.set(
        pos.x - this.tmp.x * TP_DIST + m[0] * TP_SHOULDER_X + m[4] * TP_HEIGHT,
        pos.y - this.tmp.y * TP_DIST + m[1] * TP_SHOULDER_X + m[5] * TP_HEIGHT,
        pos.z - this.tmp.z * TP_DIST + m[2] * TP_SHOULDER_X + m[6] * TP_HEIGHT,
      )
    } else {
      this.camera.position.copy(pos)
    }

    if (this.shakeFrames > 0) {
      this.camera.position.x += (Math.random() - 0.5) * 0.04
      this.camera.position.y += (Math.random() - 0.5) * 0.04
      this.shakeFrames--
    }
  }

  lateUpdate(dt: number) {
    const moving = !!(this.keys.current.forward || this.keys.current.back ||
                      this.keys.current.left || this.keys.current.right)
    // Dynamic FOV works in both FP and TP; dash and ghost phase (×2 speed) cause a spike.
    const targetFov = (this.player.dashing || this.player.isRespawning) ? DASH_FOV
      : this.player.isWindingUp ? 70 : (moving ? 87 : 75)
    this.fov = THREE.MathUtils.lerp(this.fov, targetFov, dt * 6)
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()

    if (this.controls.current) {
      this.controls.current.pointerSpeed = this.player.isWindingUp ? WINDUP_LOOK_FACTOR : 1
    }
  }
}
