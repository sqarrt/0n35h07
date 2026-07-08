import { describe, it, expect } from 'vitest'
import { cellKey } from '../../src/editor/editorStore'
import type { Cell } from '../../src/editor/editorStore'
import { regionBounds, extractRegion } from '../../src/editor/editorSelection'
import type { Vec3i } from '../../src/editor/editorSelection'

const cube = (over: Partial<Cell> = {}): Cell =>
  ({ t: 'cube', c: '#b89863', d: 0, f: false, bb: true, tr: false, ps: false, ...over })

describe('editorSelection — region & extract', () => {
  it('regionBounds нормализует углы в любом порядке', () => {
    const a: Vec3i = [5, 0, -2], b: Vec3i = [1, 3, 4]
    expect(regionBounds(a, b)).toEqual({ min: [1, 0, -2], max: [5, 3, 4] })
    expect(regionBounds(b, a)).toEqual(regionBounds(a, b))
  })

  it('extractRegion берёт только непустые ячейки, координаты относительные, атрибуты целиком', () => {
    const v = new Map<string, Cell>()
    v.set(cellKey(2, 0, 3), cube({ c: '#4af', tr: true, ps: true, bb: false }))
    v.set(cellKey(4, 1, 5), cube())
    v.set(cellKey(9, 9, 9), cube())          // вне региона
    const frag = extractRegion(v, [2, 0, 3], [4, 1, 5])
    expect(frag.size).toEqual([3, 2, 3])
    expect(frag.cells.size).toBe(2)
    expect(frag.cells.get(cellKey(0, 0, 0))).toEqual(cube({ c: '#4af', tr: true, ps: true, bb: false }))
    expect(frag.cells.get(cellKey(2, 1, 2))).toEqual(cube())
  })

  it('extractRegion одинаков при углах в любом порядке', () => {
    const v = new Map<string, Cell>([[cellKey(1, 1, 1), cube()]])
    const f1 = extractRegion(v, [0, 0, 0], [2, 2, 2])
    const f2 = extractRegion(v, [2, 2, 2], [0, 0, 0])
    expect(f2.size).toEqual(f1.size)
    expect([...f2.cells.entries()]).toEqual([...f1.cells.entries()])
  })
})
