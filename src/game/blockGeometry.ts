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

/** Две объединённые геометрии блоков карты: raycast (укрытия) и noRaycast (периметр). null если группа пуста. */
export function mergedBlockGeometries(
  blocks: MapBlock[], wedgeGeo: BufferGeometry, wedgeGeoFlip: BufferGeometry,
): { raycast: BufferGeometry | null; noRaycast: BufferGeometry | null } {
  const ray: BufferGeometry[] = []
  const noray: BufferGeometry[] = []
  for (const b of blocks) {
    const g = blockGeometry(b, wedgeGeo, wedgeGeoFlip)
    ;(b.blocksBeam === false ? noray : ray).push(g)
  }
  const merge = (arr: BufferGeometry[]) => (arr.length ? mergeGeometries(arr) : null)
  const result = { raycast: merge(ray), noRaycast: merge(noray) }
  for (const g of [...ray, ...noray]) g.dispose()
  return result
}
