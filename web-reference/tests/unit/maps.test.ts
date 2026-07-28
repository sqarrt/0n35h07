import { describe, it, expect } from 'vitest'
import { MAPS, MAP_IDS, perimeter } from '../../src/game/maps'
import { DEFAULT_MAP_ID } from '../../src/constants'

describe('maps — map registry', () => {
  it('MAP_IDS matches MAPS keys, default is in the list', () => {
    expect(MAP_IDS.length).toBe(Object.keys(MAPS).length)   // no magic number — grows with the registry
    expect([...MAP_IDS].sort()).toEqual(Object.keys(MAPS).sort())
    expect(MAP_IDS).toContain(DEFAULT_MAP_ID)
  })

  it('every map has valid id, spawns and blocks', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id]
      expect(m.id).toBe(id)
      // exactly two spawns (host, opponent), both numeric triples
      expect(m.spawns).toHaveLength(2)
      for (const sp of m.spawns) {
        expect(sp).toHaveLength(3)
        expect(sp.every(n => Number.isFinite(n))).toBe(true)
      }
      // spawns are spread apart (facing each other), not equal
      expect(m.spawns[0]).not.toEqual(m.spawns[1])
      // blocks have positive half-sizes
      expect(m.blocks.length).toBeGreaterThan(0)
      for (const b of m.blocks) {
        expect(b.size.every(s => s > 0)).toBe(true)
      }
    }
  })

  it('perimeter walls sit outside the floor — inner face exactly on the arena edge (grid node)', () => {
    const [hx, hz] = [20, 29]
    const [n, s, w, e] = perimeter('#555', hx, hz)
    // inner face (center + half toward the arena) lands on ±half; center is fully outside
    expect(n.pos[2] + n.size[2]).toBeCloseTo(-hz); expect(n.pos[2]).toBeLessThan(-hz)
    expect(s.pos[2] - s.size[2]).toBeCloseTo(hz);  expect(s.pos[2]).toBeGreaterThan(hz)
    expect(w.pos[0] + w.size[0]).toBeCloseTo(-hx); expect(w.pos[0]).toBeLessThan(-hx)
    expect(e.pos[0] - e.size[0]).toBeCloseTo(hx);  expect(e.pos[0]).toBeGreaterThan(hx)
  })

  it('maps are loaded from editor data (perimeter walls with blocksBeam:false exist)', () => {
    for (const id of MAP_IDS) {
      expect(MAPS[id].blocks.some(b => b.blocksBeam === false)).toBe(true)
    }
  })
})
