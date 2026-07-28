import * as THREE from 'three'

/**
 * Shield visual (skin). object3d is added as a CHILD of Shield.object3d — the group's visibility
 * is controlled by Shield/Player as before (including forcing a remote player's visibility from a snapshot).
 * update ticks the animation; active=true in the active phase OR when the group is visible externally
 * (remote player) — so the skin animation doesn't freeze.
 */
export interface IShieldFx {
  readonly object3d: THREE.Object3D
  update(dt: number, active: boolean): void
  dispose(): void
}
