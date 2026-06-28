import * as THREE from 'three'
import type { World } from './World'

/** What ANY controller drives (a human's keyboard or a bot's AI). */
export interface IControllable {
  moveIntent(worldDir: THREE.Vector3, dt: number): void
  setJumpInput(held: boolean): void
  aim(dir: THREE.Vector3): void
  startFiring(): void
  activateShield(): void
}

export interface WeaponContext {
  world:      World
  muzzle:     THREE.Vector3
  aim:        THREE.Vector3
  excludeIds: number[]
  pierceWalls?: boolean   // PIERCE (SINGULARITY mode): the beam ignores map blocks
  // Hit ray (optional): for a human — the aim line camera→muzzle, so the hit matches the crosshair
  // (the beam visual still comes from the muzzle, removing muzzle↔camera parallax in TP). None → hit from the muzzle along aim (bot/remote).
  hitOrigin?: THREE.Vector3
  hitDir?:    THREE.Vector3
}

export interface FireOutcome {
  end:         THREE.Vector3
  hitEntityId: number | null
  hitPoint:    THREE.Vector3 | null
}

export interface IWeapon {
  beginWindup(): void
  update(dt: number, ctx: WeaponContext): void
  reset(): void
  interrupt(): void
  spawnImpact(point: THREE.Vector3): void
  playBeam(start: THREE.Vector3, end: THREE.Vector3, hitPoint?: THREE.Vector3 | null): void
  readonly object3d:        THREE.Object3D
  readonly isWindingUp:     boolean
  readonly windupProgress:  number   // 0..1
  cooldownProgress():       number   // 1 = ready
  setCooldownScale(scale: number): void   // cooldown duration multiplier (OVERHEAT)
  resetCooldown(): void                    // instantly ready (reward for breaking a streak)
  readonly justFired:       boolean
  readonly outcome:         FireOutcome | null
  clearJustFired(): void
  dispose(): void
}

export interface IShield {
  activate(): void
  update(dt: number): void
  reset(): void
  readonly object3d:  THREE.Object3D
  readonly isActive:  boolean
  isPerfectBlock():   boolean  // activated within the window before a hit → reward by resetting cooldowns
  progress():         number   // 1 = ready
  setCooldownScale(scale: number): void
  resetCooldown(): void
  dispose(): void
}

/** Per-frame body state for rendering the dash trail. */
export interface DashTrailContext {
  position: THREE.Vector3   // point at eye level (body center)
  dashing:  boolean
}

/** Dash trail. Owns its own meshes; lives in the match's world-space group (outside RigidBody). */
export interface IDashTrail {
  readonly object3d:    THREE.Object3D
  update(dt: number, ctx: DashTrailContext): void
  readonly aliveCount:  number   // active elements (for tests/debug)
  dispose(): void
}

/** A controller drives one IControllable each frame. */
export interface Controller {
  update(dt: number): void
  /** Called AFTER physics for all players (per tick): FOV / look sensitivity. */
  lateUpdate?(dt: number): void
  /** Called once per RENDER frame with interpolation alpha ∈ [0,1): place the camera from the local player's
   *  interpolated position (so first-person doesn't judder when refresh ≠ the fixed tick rate). */
  renderCamera?(alpha: number): void
}
