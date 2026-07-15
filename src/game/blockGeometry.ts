import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { wedgeQuaternion } from './wedge'
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
    const useFlip = b.side ? false : b.flip     // on-side игнорирует флип (призма симметрична по Y)
    g = (useFlip ? wedgeGeoFlip : wedgeGeo).clone()
    g.scale(b.size[0] * 2, b.size[1] * 2, b.size[2] * 2)
    g.applyQuaternion(wedgeQuaternion(b.dir ?? 0, b.side === true))
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

const CHUNK_SIZE = 8   // world units per chunk side (X/Z); full height — for frustum culling of large maps

export interface ChunkBuckets {
  opaqueRaycast: BufferGeometry | null
  opaqueNoRaycast: BufferGeometry | null
  transparentRaycast: BufferGeometry | null
  transparentNoRaycast: BufferGeometry | null
}
export interface BlockBuckets {
  chunks: ChunkBuckets[]
  collider: BufferGeometry | null
}

interface ChunkAccum { opaqueRay: BufferGeometry[]; opaqueNoRay: BufferGeometry[]; transpRay: BufferGeometry[]; transpNoRay: BufferGeometry[] }

/** Blocks → per-chunk merged visual groups (blocksBeam × transparent) + one impassable collider (not chunked). */
export function bucketedBlockGeometries(
  blocks: MapBlock[], wedgeGeo: BufferGeometry, wedgeGeoFlip: BufferGeometry,
): BlockBuckets {
  const chunkMap = new Map<string, ChunkAccum>()
  const collide: BufferGeometry[] = []
  for (const b of blocks) {
    const g = blockGeometry(b, wedgeGeo, wedgeGeoFlip)
    if (b.passable !== true) collide.push(g.clone())   // collider — a copy (visuals are disposed below)
    const key = `${Math.floor(b.pos[0] / CHUNK_SIZE)},${Math.floor(b.pos[2] / CHUNK_SIZE)}`
    let acc = chunkMap.get(key)
    if (!acc) { acc = { opaqueRay: [], opaqueNoRay: [], transpRay: [], transpNoRay: [] }; chunkMap.set(key, acc) }
    const beam = b.blocksBeam !== false
    const transp = b.transparent === true
    ;(transp ? (beam ? acc.transpRay : acc.transpNoRay) : (beam ? acc.opaqueRay : acc.opaqueNoRay)).push(g)
  }
  const merge = (arr: BufferGeometry[]) => (arr.length ? mergeGeometries(arr) : null)
  const chunks: ChunkBuckets[] = []
  const toDispose: BufferGeometry[] = [...collide]
  for (const acc of chunkMap.values()) {
    chunks.push({
      opaqueRaycast: merge(acc.opaqueRay),
      opaqueNoRaycast: merge(acc.opaqueNoRay),
      transparentRaycast: merge(acc.transpRay),
      transparentNoRaycast: merge(acc.transpNoRay),
    })
    toDispose.push(...acc.opaqueRay, ...acc.opaqueNoRay, ...acc.transpRay, ...acc.transpNoRay)
  }
  const collider = merge(collide)
  for (const g of toDispose) g.dispose()
  return { chunks, collider }
}
