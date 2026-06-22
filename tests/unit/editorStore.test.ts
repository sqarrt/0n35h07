import { describe, it, expect } from 'vitest'
import { greedyMerge, voxelize, toMapData, serializeMap, parseMap, cellKey, VOXEL } from '../../src/editor/editorStore'
import type { Cell, CubeAttrs } from '../../src/editor/editorStore'
import type { Vec3 } from '../../src/game/maps'

// Default block flags (non-shootable/opaque/non-passable).
const DEF = { bb: true, tr: false, ps: false } as const

/** Helper: a set of same-color cubes (for checking merging/round-trip of cubes). */
function cubes(cells: [number, number, number, string][]): Map<string, Cell> {
  const m = new Map<string, Cell>()
  for (const [x, y, z, c] of cells) m.set(cellKey(x, y, z), { t: 'cube', c, d: 0, f: false, ...DEF })
  return m
}

/** Helper: a set of cube attributes for greedyMerge. */
function attrs(cells: [number, number, number, Partial<CubeAttrs> & { c: string }][]): Map<string, CubeAttrs> {
  const m = new Map<string, CubeAttrs>()
  for (const [x, y, z, a] of cells) m.set(cellKey(x, y, z), { ...DEF, ...a })
  return m
}

describe('editorStore — voxels ↔ boxes', () => {
  it('greedyMerge merges an identical row of cubes into one box', () => {
    const v = attrs([[0, 0, 0, { c: '#f00' }], [1, 0, 0, { c: '#f00' }], [2, 0, 0, { c: '#f00' }]])
    const blocks = greedyMerge(v)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].size).toEqual([1.5 * VOXEL, 0.5 * VOXEL, 0.5 * VOXEL])
    expect(blocks[0].color).toBe('#f00')
    expect(blocks[0].blocksBeam).toBe(true)
  })

  it('different colors are not merged', () => {
    const v = attrs([[0, 0, 0, { c: '#f00' }], [1, 0, 0, { c: '#0f0' }]])
    expect(greedyMerge(v)).toHaveLength(2)
  })

  it('same color but different flags — NOT merged; flags carried over to the block', () => {
    const v = attrs([[0, 0, 0, { c: '#f00' }], [1, 0, 0, { c: '#f00', tr: true }]])
    const blocks = greedyMerge(v)
    expect(blocks).toHaveLength(2)
    expect(blocks.some(b => b.transparent === true)).toBe(true)
    expect(blocks.some(b => b.transparent === undefined)).toBe(true)
  })

  it('shootable/passable flags are written to the block', () => {
    const v = attrs([[0, 0, 0, { c: '#f00', bb: false, ps: true }]])
    const [b] = greedyMerge(v)
    expect(b.blocksBeam).toBe(false)
    expect(b.passable).toBe(true)
  })

  it('cube round-trip: voxelize(toMapData(v)) === v (by occupancy and color)', () => {
    const v = cubes([
      [0, 0, 0, '#f00'], [1, 0, 0, '#f00'], [0, 1, 0, '#f00'],
      [3, 0, 2, '#0f0'], [3, 0, 3, '#0f0'],
      [-2, 0, -2, '#00f'],
    ])
    const map = toMapData(v, { half: [20, 20], floorColor: '#444', wallColor: '#555', spawns: [[0, 1.7, 5], [0, 1.7, -5]] })
    expect(voxelize(map.blocks)).toEqual(v)
  })

  it('flag round-trip: transparent/shootable/passable cube are preserved', () => {
    const v = new Map<string, Cell>([
      [cellKey(0, 0, 0), { t: 'cube', c: '#111', d: 0, f: false, bb: true, tr: true, ps: false }],
      [cellKey(2, 0, 0), { t: 'cube', c: '#222', d: 0, f: false, bb: false, tr: false, ps: true }],
    ])
    const map = toMapData(v, { half: [20, 20], floorColor: '#444', wallColor: '#555', spawns: [[0, 1.7, 5], [0, 1.7, -5]] })
    expect(voxelize(map.blocks)).toEqual(v)
  })

  it('type round-trip: cube and wedge(4 dir, normal/flipped) are preserved', () => {
    const v = new Map<string, Cell>([
      [cellKey(0, 0, 0), { t: 'cube', c: '#111', d: 0, f: false, ...DEF }],
      [cellKey(6, 0, 0), { t: 'wedge', c: '#444', d: 0, f: false, ...DEF }],
      [cellKey(6, 0, 2), { t: 'wedge', c: '#444', d: 1, f: false, ...DEF }],
      [cellKey(6, 0, 4), { t: 'wedge', c: '#444', d: 2, f: false, ...DEF }],
      [cellKey(6, 0, 6), { t: 'wedge', c: '#444', d: 3, f: false, ...DEF }],
      [cellKey(8, 0, 0), { t: 'wedge', c: '#555', d: 0, f: true, ...DEF }],
      [cellKey(8, 0, 2), { t: 'wedge', c: '#555', d: 2, f: true, ...DEF }],
    ])
    const map = toMapData(v, { half: [20, 20], floorColor: '#444', wallColor: '#555', spawns: [[0, 1.7, 5], [0, 1.7, -5]] })
    expect(voxelize(map.blocks)).toEqual(v)
  })

  it('toMapData adds a perimeter (perimeter:true), voxelize skips it', () => {
    const v = cubes([[0, 0, 0, '#fff']])
    const spawns: [Vec3, Vec3] = [[0, 1.7, 5], [0, 1.7, -5]]
    const map = toMapData(v, { half: [20, 20], floorColor: '#444', wallColor: '#555', spawns })
    expect(map.blocks.some(b => b.perimeter === true)).toBe(true)   // perimeter is present
    expect(voxelize(map.blocks)).toEqual(v)                          // but only the cube goes into voxels
  })

  it('toMapData carries showBlockGrid: true sets the field, otherwise it is omitted', () => {
    const v = cubes([[0, 0, 0, '#fff']])
    const opts = { half: [20, 20] as [number, number], floorColor: '#444', wallColor: '#555', spawns: [[0, 1.7, 5], [0, 1.7, -5]] as [Vec3, Vec3] }
    expect(toMapData(v, { ...opts, showBlockGrid: true }).showBlockGrid).toBe(true)
    expect(toMapData(v, { ...opts, showBlockGrid: false }).showBlockGrid).toBeUndefined()
    expect(toMapData(v, opts).showBlockGrid).toBeUndefined()
  })

  it('serialize → parse round-trip; parse rejects garbage', () => {
    const v = cubes([[0, 0, 0, '#abc']])
    const map = toMapData(v, { half: [20, 30], floorColor: '#444', wallColor: '#555', spawns: [[0, 1.7, 5], [0, 1.7, -5]] })
    const parsed = parseMap(serializeMap(map))
    expect(parsed).not.toBeNull()
    expect(parsed!.half).toEqual([20, 30])
    expect(parseMap('not json')).toBeNull()
    expect(parseMap('{"half":[1]}')).toBeNull()
  })
})
