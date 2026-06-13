import * as THREE from 'three'
import { performRaycast } from '../utils/raycast'

/**
 * Обёртка над сценой: единая точка для raycast и спавна.
 * Меши с userData.noRaycast игнорируются; меши своей команды исключаются по entityId.
 */
export class World {
  private scene: THREE.Scene
  constructor(scene: THREE.Scene) { this.scene = scene }

  /** Ближайшее пересечение луча или null. pierceWalls — игнорировать блоки карты (ПРОСТРЕЛ на SINGULARITY). */
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

  /** Прозрачность блоков карты (видно сквозь стены в режиме SINGULARITY). on=false — вернуть непрозрачность. */
  setBlocksTransparent(on: boolean) {
    this.scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh) || !obj.userData.block) return
      const m = obj.material as THREE.MeshStandardMaterial
      m.transparent = on
      m.opacity = on ? 0.2 : 1
      m.depthWrite = !on   // прозрачные блоки не должны перекрывать игроков
    })
  }
}
