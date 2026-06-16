import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { wedgeRotationY } from './wedge'
import type { MapBlock } from './maps'

/**
 * Батчинг блоков карты: вместо сотен мешей (по одному на блок) — две объединённые геометрии.
 * Делим по лучу: укрытия (blocksBeam:true) → raycast, периметр (blocksBeam:false) → noRaycast,
 * чтобы поведение луча (см. utils/raycast — пропуск userData.noRaycast) сохранилось.
 *
 * Все геометрии группы должны быть не-индексированными (BoxGeometry индексирована → toNonIndexed),
 * без uv и с вершинным атрибутом color — тогда боксы и клинья сливаются вместе (meshStandardMaterial
 * с vertexColors даёт тот же вид, что per-mesh color).
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

/** Блоки → 4 визуальные слитые группы (blocksBeam × transparent) + collider (непроходимые). null если пусто. */
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
    if (b.passable !== true) collide.push(g.clone())   // collider — копия (визуал диспозим ниже)
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
