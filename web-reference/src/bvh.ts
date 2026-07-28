import { BufferGeometry, Mesh } from 'three'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'

/**
 * Accelerated raycast over trimesh via BVH. Combat raycasts against map block mesh geometry (thousands
 * of triangles) on EVERY shot — a naive Raycaster is linear in triangles and causes a frame spike
 * (noticeable at 120 FPS). BVH makes the intersection O(log n).
 *
 * One-time prototype patch (imported in main.tsx before render). A mesh builds the tree via
 * geometry.computeBoundsTree(); meshes without a tree use plain raycast (fallback inside acceleratedRaycast).
 */
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast
