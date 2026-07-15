import { describe, it, expect } from 'vitest'
import { compileBlocks, serializeGeo, parseGeo, isEmptyCompiled } from '../../src/game/mapGeometryCache'
import type { MapBlock } from '../../src/game/maps'

const cube = (x: number, z: number, over: Partial<MapBlock> = {}): MapBlock =>
  ({ pos: [x, 0.25, z], size: [0.25, 0.25, 0.25], color: '#888', blocksBeam: true, ...over })

describe('map chunking', () => {
  it('блоки в разных чанках (по центру, шаг 8) идут в разные чанки; вершины не теряются', () => {
    // x=0 → чанк 0, x=20 → чанк 2 (20/8=2.5→2)
    const c = compileBlocks([cube(0, 0), cube(20, 0)])
    expect(c.chunks.length).toBe(2)
    const opaqueVerts = c.chunks.map(ch => ch.opaqueRaycast?.position.length ?? 0)
    expect(opaqueVerts.filter(n => n > 0).length).toBe(2)
    expect(opaqueVerts.reduce((a, b) => a + b, 0)).toBe(2 * 36 * 3)   // 2 бокса × 36 верт × 3 компонента
    expect(c.collider?.position.length).toBe(2 * 36 * 3)             // коллайдер один, покрывает оба
  })

  it('соседние блоки в одном чанке дают один чанк', () => {
    const c = compileBlocks([cube(0, 0), cube(0.5, 0)])
    expect(c.chunks.length).toBe(1)
  })

  it('passable-блок не попадает в коллайдер, но остаётся в визуале', () => {
    const c = compileBlocks([cube(0, 0, { passable: true })])
    expect(c.collider).toBeNull()
    expect(c.chunks[0].opaqueRaycast?.position.length).toBe(36 * 3)
  })

  it('serializeGeo → parseGeo — round-trip нового формата', () => {
    const c = compileBlocks([cube(0, 0), cube(20, 0)])
    const p = parseGeo(serializeGeo(c))
    expect(p.chunks.length).toBe(c.chunks.length)
    expect(p.collider?.position.length).toBe(c.collider?.position.length)
    expect(isEmptyCompiled(p)).toBe(false)
  })

  it('parseGeo старого формата (без chunks) → пустая CompiledMap (фолбэк)', () => {
    const p = parseGeo(JSON.stringify({ opaqueRaycast: null, collider: null }))
    expect(p.chunks).toEqual([])
    expect(isEmptyCompiled(p)).toBe(true)
  })
})
