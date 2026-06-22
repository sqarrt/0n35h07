import { describe, it, expect } from 'vitest'
import { MAPS, MAP_IDS } from '../../src/game/maps'
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

  it('maps are loaded from editor data (perimeter walls with blocksBeam:false exist)', () => {
    for (const id of MAP_IDS) {
      expect(MAPS[id].blocks.some(b => b.blocksBeam === false)).toBe(true)
    }
  })
})
