import { BufferGeometry, Mesh } from 'three'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'

/**
 * Ускоренный raycast по trimesh через BVH. Боёвка бьёт лучом по меш-геометрии блоков карты (тысячи
 * треугольников) на КАЖДЫЙ выстрел — наивный Raycaster линеен по треугольникам и даёт спайк кадра
 * (заметно на 120 FPS в Electron). BVH делает пересечение O(log n).
 *
 * Патч прототипов one-time (импортируется в main.tsx до рендера). Меш строит дерево через
 * geometry.computeBoundsTree(); меши без дерева используют обычный raycast (fallback внутри acceleratedRaycast).
 */
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast
