import { BufferGeometry, Float32BufferAttribute } from 'three'
import { VOXEL } from '../constants'
import type { MapBlock } from './maps'

/**
 * Сетка кубов — рёбра воксельных клеток (как «грани кубов» в редакторе, клавиша L). Общий примитив для
 * редактора (от его voxels) и игры (от map.blocks). Перечисление клеток зеркалит editorStore.voxelize,
 * поэтому игровая сетка совпадает с редакторской клетка-в-клетку.
 */

// Стиль сетки кубов — единый для редактора и игры.
export const BLOCK_GRID_COLOR = '#4af'
export const BLOCK_GRID_OPACITY = 0.5

const EPS = 1e-3   // допуск привязки клина к клетке (как в voxelize)

// Рёбра единичной клетки: 8 углов (полу-ребро) + 12 рёбер (пары индексов).
const EDGE_CORNERS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
  [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
]
const EDGE_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
]

/** Мировой центр клетки (i,j,k): спан клетки = [i·VOXEL, (i+1)·VOXEL] и т.д. */
export const cellCenter = (x: number, y: number, z: number): [number, number, number] =>
  [(x + 0.5) * VOXEL, (y + 0.5) * VOXEL, (z + 0.5) * VOXEL]

/** Геометрия рёбер набора воксельных клеток (линии по 12 рёбрам каждой клетки) — для <lineSegments>. */
export function cellsGridGeometry(cells: Iterable<readonly [number, number, number]>): BufferGeometry {
  const pos: number[] = []
  for (const [x, y, z] of cells) {
    const [cx, cy, cz] = cellCenter(x, y, z)
    for (const [a, b] of EDGE_PAIRS) {
      const pa = EDGE_CORNERS[a], pb = EDGE_CORNERS[b]
      pos.push(cx + pa[0] * VOXEL, cy + pa[1] * VOXEL, cz + pa[2] * VOXEL,
        cx + pb[0] * VOXEL, cy + pb[1] * VOXEL, cz + pb[2] * VOXEL)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  return g
}

/** Воксельные клетки, занятые блоками карты (периметр пропускаем — он не воксель). Дедуп по ключу. */
export function blockCells(blocks: MapBlock[]): [number, number, number][] {
  const S = VOXEL
  const seen = new Set<string>()
  const cells: [number, number, number][] = []
  const add = (x: number, y: number, z: number) => {
    const k = `${x},${y},${z}`
    if (seen.has(k)) return
    seen.add(k)
    cells.push([x, y, z])
  }
  for (const b of blocks) {
    if (b.perimeter === true) continue
    if (b.shape === 'wedge') {                       // клин — под-клеточная призма, одна клетка
      add(
        Math.floor((b.pos[0] - b.size[0] + EPS) / S),
        Math.floor((b.pos[1] - b.size[1] + EPS) / S),
        Math.floor((b.pos[2] - b.size[2] + EPS) / S),
      )
      continue
    }
    const [sx, sy, sz] = b.size                      // куб / склеенный бокс → заполнить клетки
    const x0 = Math.round((b.pos[0] - sx) / S), x1 = Math.round((b.pos[0] + sx) / S)
    const y0 = Math.round((b.pos[1] - sy) / S), y1 = Math.round((b.pos[1] + sy) / S)
    const z0 = Math.round((b.pos[2] - sz) / S), z1 = Math.round((b.pos[2] + sz) / S)
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) add(x, y, z)
  }
  return cells
}

/** Геометрия сетки кубов карты — рёбра всех воксельных клеток, занятых блоками. */
export function blockGridGeometry(blocks: MapBlock[]): BufferGeometry {
  return cellsGridGeometry(blockCells(blocks))
}
