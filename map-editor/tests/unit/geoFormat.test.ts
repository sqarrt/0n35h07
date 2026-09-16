import { describe, it, expect } from 'vitest'
import { compileBlocks, serializeGeo, parseGeo } from '../../src/game/mapGeometryCache'
import { perimeter } from '../../src/game/maps'
import type { MapBlock } from '../../src/game/maps'

/**
 * The contract with the game: `nodes/geo_loader.gd` reads exactly what `serializeGeo` writes — `chunks[]` of four
 * named groups plus one `collider`, each group three base64 strings of Float32 triples. A change here breaks every
 * map the game ships, so it is pinned.
 */
const GROUPS = ['opaqueRaycast', 'opaqueNoRaycast', 'transparentRaycast', 'transparentNoRaycast'] as const
const FLOATS_PER_TRIANGLE = 9   // three vertices of three floats
const HALF = 4

const cube = (over: Partial<MapBlock> = {}): MapBlock =>
  ({ pos: [0, 0.5, 0], size: [0.25, 0.25, 0.25], color: '#b89863', blocksBeam: true, ...over })

const floats = (b64: string): Float32Array =>
  new Float32Array(Uint8Array.from(Buffer.from(b64, 'base64')).buffer)

function geoOf(blocks: MapBlock[]): Record<string, never> & { chunks: unknown[]; collider: unknown } {
  return JSON.parse(serializeGeo(compileBlocks(blocks)))
}

describe('the geo.json the game loads', () => {
  it('is chunks of four groups and one collider', () => {
    const geo = geoOf([...perimeter('#5a6678', HALF, HALF), cube()])
    expect(Array.isArray(geo.chunks)).toBe(true)
    expect(geo.chunks.length).toBeGreaterThan(0)
    for (const chunk of geo.chunks as Record<string, unknown>[]) {
      expect(Object.keys(chunk).sort()).toEqual([...GROUPS].sort())
    }
    expect(geo.collider).not.toBeNull()
  })

  it('writes every group as three base64 arrays of whole triangles', () => {
    const geo = geoOf([...perimeter('#5a6678', HALF, HALF), cube(), cube({ pos: [1, 0.5, 0], transparent: true })])
    const groups = (geo.chunks as Record<string, { position: string; normal: string; color: string } | null>[])
      .flatMap(chunk => GROUPS.map(name => chunk[name]))
      .concat([geo.collider as { position: string; normal: string; color: string }])
      .filter(g => g !== null)
    expect(groups.length).toBeGreaterThan(1)
    for (const group of groups) {
      expect(Object.keys(group).sort()).toEqual(['color', 'normal', 'position'])
      const position = floats(group.position)
      expect(position.length % FLOATS_PER_TRIANGLE).toBe(0)
      expect(position.length).toBeGreaterThan(0)
      expect(floats(group.normal).length).toBe(position.length)
      expect(floats(group.color).length).toBe(position.length)   // a colour per vertex, no alpha
    }
  })

  it('a passable block leaves the collider but stays visible', () => {
    const solid = geoOf([cube()])
    const passable = geoOf([cube({ passable: true })])
    expect(floats((solid.collider as { position: string }).position).length).toBeGreaterThan(0)
    expect(passable.collider).toBeNull()
    expect(passable.chunks.length).toBe(solid.chunks.length)
  })

  it('round-trips through parseGeo', () => {
    const compiled = compileBlocks([cube()])
    const back = parseGeo(JSON.parse(serializeGeo(compiled)))
    expect(back.chunks.length).toBe(compiled.chunks.length)
    expect(back.collider?.position).toEqual(compiled.collider?.position)
  })
})
