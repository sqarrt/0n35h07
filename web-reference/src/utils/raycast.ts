import * as THREE from 'three'

export interface MeshUserData {
  entityId?: number
  noRaycast?: boolean
}

export interface RaycastOptions {
  excludeNames?: string[]
  excludeUserDataKeys?: string[]
  excludeEntityIds?: number[]
}

// Reusable Raycaster (no allocation per shot). firstHitOnly — BVH mode (three-mesh-bvh):
// on a mesh with a boundsTree it returns only the nearest hit, skipping the remaining triangles.
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
    const ud = obj.userData as MeshUserData
    if (excludeUserDataKeys.some(k => obj.userData[k])) return
    if (ud.entityId !== undefined && excludeEntityIds.includes(ud.entityId)) return
    targets.push(obj)
  })
  raycaster.set(origin, direction)
  return raycaster.intersectObjects(targets)
}
