import type * as THREE from 'three'

/** Respawn animation target: orb mesh + material + opacity setter
 *  (Body's setOpacity tints the sphere + planet ring; the preview passes its own equivalent). */
export interface RespawnTarget {
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  setOpacity(o: number): void
}

/**
 * Per-frame respawn state (assembled by the owner: Player or preview).
 * `origin` — orb center in the PARENT object3d's coordinates (match: match.root/world; preview: orb group).
 */
export interface RespawnFrame {
  ghost: number | null     // ghost phase: remainder 1→0; null — not a ghost
  sinceRebirthMs: number   // ms since last materialization (including first spawn)
  baseColor: THREE.Color
  origin: THREE.Vector3
  visible: boolean         // false (FP: own player) — hide world-part and mesh effects
}

/**
 * Respawn animation strategy. During the ghost phase and the rebirth window (its own duration,
 * see isRebirthActive) it owns mesh.scale, mesh.visible, material.color and opacity
 * (target.setOpacity); on the first apply outside its phases it must restore neutral state
 * (mesh.visible = f.visible, mesh offsets = 0) and hide the world-part; afterwards — no-op
 * (visuals are owned by windup/others, opacity is set by Player).
 */
export interface IRespawnFx {
  readonly object3d: THREE.Object3D     // world-part (shards/particles/OWN ghost trail) — lives in match.root
  onDeath(pos: THREE.Vector3): void     // moment of death (pop/burst/scatter)
  apply(dt: number, target: RespawnTarget, f: RespawnFrame): void
  /** Is the rebirth window still active? (Player hides the shield during it — like the old "poof".) */
  isRebirthActive(sinceRebirthMs: number): boolean
  update(dt: number): void              // particle tick (alive outside phases too, like DeathBurst)
  dispose(): void
}
