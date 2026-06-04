import { describe, it, expect } from 'vitest'
import { greedyMerge, voxelize, toMapData, serializeMap, parseMap, cellKey, VOXEL } from '../../src/editor/editorStore'
import type { Vec3 } from '../../src/game/maps'

function vox(cells: [number, number, number, string][]): Map<string, string> {
  const m = new Map<string, string>()
  for (const [x, y, z, c] of cells) m.set(cellKey(x, y, z), c)
  return m
}

describe('editorStore — воксели ↔ боксы', () => {
  it('greedyMerge склеивает одноцветный ряд в один бокс', () => {
    const v = vox([[0, 0, 0, '#f00'], [1, 0, 0, '#f00'], [2, 0, 0, '#f00']])
    const blocks = greedyMerge(v)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].size).toEqual([1.5 * VOXEL, 0.5 * VOXEL, 0.5 * VOXEL])
    expect(blocks[0].color).toBe('#f00')
    expect(blocks[0].blocksBeam).toBe(true)
  })

  it('разные цвета не склеиваются', () => {
    const v = vox([[0, 0, 0, '#f00'], [1, 0, 0, '#0f0']])
    expect(greedyMerge(v)).toHaveLength(2)
  })

  it('round-trip: voxelize(greedyMerge(v)) === v (по занятости и цвету)', () => {
    const v = vox([
      [0, 0, 0, '#f00'], [1, 0, 0, '#f00'], [0, 1, 0, '#f00'],
      [3, 0, 2, '#0f0'], [3, 0, 3, '#0f0'],
      [-2, 0, -2, '#00f'],
    ])
    const back = voxelize(greedyMerge(v))
    expect(back).toEqual(v)
  })

  it('toMapData добавляет периметр (blocksBeam:false), voxelize его пропускает', () => {
    const v = vox([[0, 0, 0, '#fff']])
    const spawns: [Vec3, Vec3] = [[0, 1.7, 5], [0, 1.7, -5]]
    const map = toMapData(v, { half: [20, 20], floorColor: '#444', wallColor: '#555', spawns })
    expect(map.blocks.some(b => b.blocksBeam === false)).toBe(true)   // периметр есть
    expect(voxelize(map.blocks)).toEqual(v)                            // но в воксели идёт только куб
  })

  it('serialize → parse round-trip; parse отбраковывает мусор', () => {
    const v = vox([[0, 0, 0, '#abc']])
    const map = toMapData(v, { half: [20, 30], floorColor: '#444', wallColor: '#555', spawns: [[0, 1.7, 5], [0, 1.7, -5]] })
    const parsed = parseMap(serializeMap(map))
    expect(parsed).not.toBeNull()
    expect(parsed!.half).toEqual([20, 30])
    expect(parseMap('not json')).toBeNull()
    expect(parseMap('{"half":[1]}')).toBeNull()
  })
})
