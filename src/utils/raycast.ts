import * as THREE from 'three'

export interface RaycastOptions {
  excludeNames?: string[]
  excludeUserDataKeys?: string[]
  excludeEntityIds?: number[]
}

// Переиспользуемый Raycaster (без аллокации на каждый выстрел). firstHitOnly — режим BVH (three-mesh-bvh):
// на меше с boundsTree возвращает только ближайший хит, не перебирая остальные треугольники.
const raycaster = new THREE.Raycaster()
;(raycaster as unknown as { firstHitOnly: boolean }).firstHitOnly = true

export function performRaycast(
  scene: THREE.Scene,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  opts: RaycastOptions = {}
): THREE.Intersection[] {
  const { excludeNames = [], excludeUserDataKeys = ['noRaycast'], excludeEntityIds = [] } = opts
  const targets: THREE.Object3D[] = []
  scene.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    if (excludeNames.includes(obj.name)) return
    if (excludeUserDataKeys.some(k => obj.userData[k])) return
    if (obj.userData.entityId !== undefined && excludeEntityIds.includes(obj.userData.entityId)) return
    targets.push(obj)
  })
  raycaster.set(origin, direction)
  return raycaster.intersectObjects(targets)
}
