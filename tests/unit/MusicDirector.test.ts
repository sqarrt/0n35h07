import { describe, it, expect } from 'vitest'
import { MusicDirector } from '../../src/game/audio/MusicDirector'
import type { StemLibrary } from '../../src/game/audio/types'

// Синтетическая библиотека — тесты не зависят от реальных ассетов.
const LIB: StemLibrary = {
  bass:  [{ id: 'bass/b1', url: 'b1' }, { id: 'bass/b2', url: 'b2' }],
  kicks: [{ id: 'kicks/k1', url: 'k1' }, { id: 'kicks/k2', url: 'k2' }],
  lead:  [{ id: 'lead/l1', url: 'l1' }, { id: 'lead/l2', url: 'l2' }],
  sfx:   [{ id: 'sfx/s1', url: 's1' }, { id: 'sfx/s2', url: 's2' }],
}
const rolesOf = (arr: { role: string }[]) => arr.map(v => v.role).sort()

describe('MusicDirector.compose', () => {
  const d = new MusicDirector()

  it('детерминирован: (seed, loopIndex, section) → одинаковая аранжировка', () => {
    expect(d.compose(42, 5, LIB, 'full')).toEqual(d.compose(42, 5, LIB, 'full'))
  })

  it('intro: только kicks+bass', () => {
    expect(rolesOf(d.compose(42, 0, LIB, 'intro'))).toEqual(['bass', 'kicks'])
    expect(rolesOf(d.compose(42, 7, LIB, 'intro'))).toEqual(['bass', 'kicks'])
  })

  it('full: все четыре роли', () => {
    expect(rolesOf(d.compose(42, 2, LIB, 'full'))).toEqual(['bass', 'kicks', 'lead', 'sfx'])
  })

  it('finale: только kicks+lead', () => {
    expect(rolesOf(d.compose(42, 9, LIB, 'finale'))).toEqual(['kicks', 'lead'])
  })

  it('все stemId существуют в библиотеке', () => {
    const all = new Set(Object.values(LIB).flat().map(s => s.id))
    for (const v of d.compose(7, 9, LIB, 'full')) expect(all.has(v.stemId)).toBe(true)
  })

  it('у каждого голоса положительный gain', () => {
    for (const v of d.compose(7, 2, LIB, 'full')) expect(v.gain).toBeGreaterThan(0)
  })
})
