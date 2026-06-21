import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { wedgeRotationY } from './wedge'
import type { MapBlock } from './maps'

/**
 * Map block batching: instead of hundreds of meshes (one per block) — two merged geometries.
 * Split by beam: cover (blocksBeam:true) → raycast, perimeter (blocksBeam:false) → noRaycast,
 * so the beam behavior (see utils/raycast — skipping userData.noRaycast) is preserved.
 *
 * All geometries in a group must be non-indexed (BoxGeometry is indexed → toNonIndexed),
 * without uv and with a vertex color attribute — then boxes and wedges merge together
 * (meshStandardMaterial with vertexColors gives the same look as per-mesh color).
 */
function blockGeometry(b: MapBlock, wedgeGeo: BufferGeometry, wedgeGeoFlip: BufferGeometry): BufferGeometry {
  let g: BufferGeometry
  if (b.shape === 'wedge') {
    g = (b.flip ? wedgeGeoFlip : wedgeGeo).clone()
    g.scale(b.size[0] * 2, b.size[1] * 2, b.size[2] * 2)
    g.rotateY(wedgeRotationY(b.dir ?? 0))
  } else {
    g = new BoxGeometry(b.size[0] * 2, b.size[1] * 2, b.size[2] * 2).toNonIndexed()
    if (b.rot) { g.rotateX(b.rot[0]); g.rotateY(b.rot[1]); g.rotateZ(b.rot[2]) }
  }
  g.translate(b.pos[0], b.pos[1], b.pos[2])
  g.deleteAttribute('uv')

  const c = new Color(b.color)
  const n = g.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return g
}

export interface BlockBuckets {
  opaqueRaycast: BufferGeometry | null
  opaqueNoRaycast: BufferGeometry | null
  transparentRaycast: BufferGeometry | null
  transparentNoRaycast: BufferGeometry | null
  collider: BufferGeometry | null
}

/** Blocks → 4 merged visual groups (blocksBeam × transparent) + collider (impassable). null if empty. */
export function bucketedBlockGeometries(
  blocks: MapBlock[], wedgeGeo: BufferGeometry, wedgeGeoFlip: BufferGeometry,
): BlockBuckets {
  const opaqueRay: BufferGeometry[] = [], opaqueNoRay: BufferGeometry[] = []
  const transpRay: BufferGeometry[] = [], transpNoRay: BufferGeometry[] = []
  const collide: BufferGeometry[] = []
  for (const b of blocks) {
    const g = blockGeometry(b, wedgeGeo, wedgeGeoFlip)
    const beam = b.blocksBeam !== false
    const transp = b.transparent === true
    const visual = transp ? (beam ? transpRay : transpNoRay) : (beam ? opaqueRay : opaqueNoRay)
    visual.push(g)
    if (b.passable !== true) collide.push(g.clone())   // collider — a copy (visuals are disposed below)
  }
  const merge = (arr: BufferGeometry[]) => (arr.length ? mergeGeometries(arr) : null)
  const result: BlockBuckets = {
    opaqueRaycast: merge(opaqueRay),
    opaqueNoRaycast: merge(opaqueNoRay),
    transparentRaycast: merge(transpRay),
    transparentNoRaycast: merge(transpNoRay),
    collider: merge(collide),
  }
  for (const g of [...opaqueRay, ...opaqueNoRay, ...transpRay, ...transpNoRay, ...collide]) g.dispose()
  return result
}
