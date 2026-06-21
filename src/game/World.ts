import * as THREE from 'three'
import { performRaycast } from '../utils/raycast'

/**
 * Wrapper over the scene: a single point for raycast and spawning.
 * Meshes with userData.noRaycast are ignored; own-team meshes are excluded by entityId.
 */
export class World {
  private scene: THREE.Scene
  constructor(scene: THREE.Scene) { this.scene = scene }

  /** Nearest ray intersection or null. pierceWalls — ignore map blocks (PIERCE on SINGULARITY). */
  raycast(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    excludeIds: number[] = [],
    pierceWalls = false
  ): THREE.Intersection | null {
    const hits = performRaycast(this.scene, origin.clone(), dir.clone().normalize(), {
      excludeEntityIds: excludeIds,
      excludeUserDataKeys: pierceWalls ? ['noRaycast', 'block'] : ['noRaycast'],
    })
    return hits.length > 0 ? hits[0] : null
  }

  /** Map block transparency (see through walls in SINGULARITY mode). on=false — restore opacity. */
  setBlocksTransparent(on: boolean) {
    this.scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh) || !obj.userData.block) return
      const base = (obj.userData.baseOpacity as number | undefined) ?? 1   // glass blocks restore to their opacity, not to 1
      const m = obj.material as THREE.MeshStandardMaterial
      m.transparent = on || base < 1
      m.opacity = on ? 0.2 : base
      m.depthWrite = !(on || base < 1)   // transparent blocks must not occlude players
    })
  }
}
