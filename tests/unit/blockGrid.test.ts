import { describe, it, expect } from 'vitest'
import { blockCells, blockGridGeometry, cellsGridGeometry } from '../../src/game/blockGrid'
import { VOXEL } from '../../src/constants'
import type { MapBlock } from '../../src/game/maps'

// Геометрия рёбер на клетку: 12 рёбер × 2 вершины × 3 координаты.
const FLOATS_PER_CELL = 12 * 2 * 3

/** Куб-блок, занимающий клетки [x0..x1)×[y0..y1)×[z0..z1) (в индексах клеток). */
function boxBlock(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, extra: Partial<MapBlock> = {}): MapBlock {
  const min = [x0 * VOXEL, y0 * VOXEL, z0 * VOXEL]
  const max = [x1 * VOXEL, y1 * VOXEL, z1 * VOXEL]
  return {
    pos: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    size: [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2],
    color: '#888',
    ...extra,
  }
}

const keys = (cells: [number, number, number][]) => new Set(cells.map(c => c.join(',')))

describe('blockGrid — сетка кубов из блоков', () => {
  it('единичный куб → одна клетка', () => {
    const cells = blockCells([boxBlock(0, 1, 0, 1, 0, 1)])
    expect(cells).toHaveLength(1)
    expect(cells[0]).toEqual([0, 0, 0])
  })

  it('склеенная колонна по Y → клетки по каждому вокселю', () => {
    const cells = blockCells([boxBlock(0, 1, 0, 3, 0, 1)])   // 1×3×1 воксель
    expect(cells).toHaveLength(3)
    expect(keys(cells)).toEqual(keys([[0, 0, 0], [0, 1, 0], [0, 2, 0]]))
  })

  it('периметр пропускается (не воксель)', () => {
    const wall = boxBlock(0, 4, 0, 3, 0, 1, { perimeter: true })
    expect(blockCells([wall])).toHaveLength(0)
  })

  it('пересекающиеся блоки дедуплицируют общие клетки', () => {
    const a = boxBlock(0, 2, 0, 1, 0, 1)   // клетки (0,0,0),(1,0,0)
    const b = boxBlock(1, 3, 0, 1, 0, 1)   // клетки (1,0,0),(2,0,0) — (1,0,0) общая
    const cells = blockCells([a, b])
    expect(cells).toHaveLength(3)
    expect(keys(cells)).toEqual(keys([[0, 0, 0], [1, 0, 0], [2, 0, 0]]))
  })

  it('клин (wedge) → одна клетка', () => {
    const wedge: MapBlock = { pos: [VOXEL / 2, VOXEL / 2, VOXEL / 2], size: [VOXEL / 2, VOXEL / 2, VOXEL / 2], color: '#888', shape: 'wedge', dir: 0 }
    expect(blockCells([wedge])).toEqual([[0, 0, 0]])
  })

  it('геометрия: длина позиций = клетки × рёбра на клетку', () => {
    const g = blockGridGeometry([boxBlock(0, 1, 0, 1, 0, 1), boxBlock(0, 1, 1, 2, 0, 1)])   // 2 клетки
    expect(g.getAttribute('position').array.length).toBe(2 * FLOATS_PER_CELL)
    g.dispose()
  })

  it('геометрия клетки лежит в её спане [0..VOXEL]', () => {
    const g = cellsGridGeometry([[0, 0, 0]])
    const arr = g.getAttribute('position').array as ArrayLike<number>
    let min = Infinity, max = -Infinity
    for (let i = 0; i < arr.length; i++) { min = Math.min(min, arr[i]); max = Math.max(max, arr[i]) }
    expect(min).toBeCloseTo(0)
    expect(max).toBeCloseTo(VOXEL)
    g.dispose()
  })

  it('пустой список блоков → пустая геометрия', () => {
    const g = blockGridGeometry([])
    expect(g.getAttribute('position').array.length).toBe(0)
    g.dispose()
  })
})
