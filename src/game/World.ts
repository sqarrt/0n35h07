import * as THREE from 'three'
import { performRaycast } from '../utils/raycast'
import { SPAWN_HALF, EYE_HEIGHT } from '../constants'

/**
 * Обёртка над сценой: единая точка для raycast и спавна.
 * Меши с userData.noRaycast игнорируются; меши своей команды исключаются по entityId.
 */
export class World {
  private scene: THREE.Scene
  constructor(scene: THREE.Scene) { this.scene = scene }

  /** Ближайшее пересечение луча или null. */
  raycast(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    excludeIds: number[] = []
  ): THREE.Intersection | null {
    const hits = performRaycast(this.scene, origin.clone(), dir.clone().normalize(), {
      excludeEntityIds: excludeIds,
    })
    return hits.length > 0 ? hits[0] : null
  }

  /** Случайная точка спавна на уровне глаз. */
  randomSpawn(): THREE.Vector3 {
    return new THREE.Vector3(
      (Math.random() - 0.5) * SPAWN_HALF * 2,
      EYE_HEIGHT,
      (Math.random() - 0.5) * SPAWN_HALF * 2,
    )
  }
}
