import { describe, it, expect } from 'vitest'
import { MAPS, MAP_IDS } from '../../src/game/maps'
import { DEFAULT_MAP_ID } from '../../src/constants'

describe('maps — реестр карт', () => {
  it('MAP_IDS совпадает с ключами MAPS, дефолт входит в список', () => {
    expect(MAP_IDS.length).toBe(3)
    expect([...MAP_IDS].sort()).toEqual(Object.keys(MAPS).sort())
    expect(MAP_IDS).toContain(DEFAULT_MAP_ID)
  })

  it('у каждой карты валидные id, спавны и блоки', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id]
      expect(m.id).toBe(id)
      // ровно два спавна (host, opponent), оба — числовые тройки
      expect(m.spawns).toHaveLength(2)
      for (const sp of m.spawns) {
        expect(sp).toHaveLength(3)
        expect(sp.every(n => Number.isFinite(n))).toBe(true)
      }
      // спавны разнесены (друг напротив друга), не совпадают
      expect(m.spawns[0]).not.toEqual(m.spawns[1])
      // блоки — положительные полу-размеры
      expect(m.blocks.length).toBeGreaterThan(0)
      for (const b of m.blocks) {
        expect(b.size.every(s => s > 0)).toBe(true)
      }
    }
  })

  it('карты загружены из данных редактора (есть периметр-стены blocksBeam:false)', () => {
    for (const id of MAP_IDS) {
      expect(MAPS[id].blocks.some(b => b.blocksBeam === false)).toBe(true)
    }
  })
})
