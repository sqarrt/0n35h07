import type * as THREE from 'three'

/** Charge animation target: the ball mesh + material (combat Body or menu preview). */
export interface WindupTarget {
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
}

/**
 * Per-frame charge state (assembled by the owner: Player or preview).
 * `origin`/`aimDir` are in the coordinate space of object3d's PARENT (in a match the parent is match.root → world;
 * in the preview object3d is a child of the scaled ball group → the group's local coordinates).
 */
export interface WindupFrame {
  progress: number       // 0..1 charge (0 — no charge)
  shrink: number         // 0..1 progress of the "deflate" after firing (1 — finished/not applicable)
  baseColor: THREE.Color // base ball color
  aimDir: THREE.Vector3  // aim direction (orientation of the world-space part)
  origin: THREE.Vector3  // position of the ball center
  visible: boolean       // false — hide the world-space part (FP: own player isn't visible)
}

/**
 * Shot windup animation strategy. During the charge/deflate phases it owns the target's mesh.scale,
 * material.color and material.emissive and must return them to base in the neutral frame
 * (progress=0, shrink=1). It does NOT touch material.opacity (owned by the ghost/fades).
 */
export interface IWindupFx {
  readonly object3d: THREE.Object3D   // world-space part (jaws/vortex); empty Group for classic
  apply(dt: number, target: WindupTarget, frame: WindupFrame): void
  dispose(): void
}
