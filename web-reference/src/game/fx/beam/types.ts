import type * as THREE from 'three'

/**
 * Shot beam visual strategy (style cosmetics, chosen together with WindupStyle).
 * Owns the beam/afterglow meshes; doesn't affect combat (all meshes are noRaycast, the combat
 * raycast is computed by BeamWeapon separately). `play(start, end)` starts the shot animation,
 * `update(dt)` drives it until it fades, `reset()` clears it instantly (respawn/end of match).
 */
export interface IBeamFx {
  readonly object3d: THREE.Object3D
  play(start: THREE.Vector3, end: THREE.Vector3): void
  update(dt: number): void
  reset(): void
  dispose(): void
}
