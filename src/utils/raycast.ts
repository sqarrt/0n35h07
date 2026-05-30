import * as THREE from 'three'

export interface RaycastOptions {
  excludeNames?: string[]
  excludeUserDataKeys?: string[]
}

export function performRaycast(
  scene: THREE.Scene,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  opts: RaycastOptions = {}
): THREE.Intersection[] {
  const { excludeNames = [], excludeUserDataKeys = ['noRaycast'] } = opts
  const targets: THREE.Object3D[] = []
  scene.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    if (excludeNames.includes(obj.name)) return
    if (excludeUserDataKeys.some(k => obj.userData[k])) return
    targets.push(obj)
  })
  return new THREE.Raycaster(origin, direction).intersectObjects(targets)
}
