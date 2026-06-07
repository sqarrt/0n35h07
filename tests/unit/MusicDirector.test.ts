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

  it('детерминирован: (seed, loopIndex) → одинаковая аранжировка', () => {
    expect(d.compose(42, 5, LIB)).toEqual(d.compose(42, 5, LIB))
  })

  it('интро (loopIndex 0,1): только kicks+bass', () => {
    expect(rolesOf(d.compose(42, 0, LIB))).toEqual(['bass', 'kicks'])
    expect(rolesOf(d.compose(42, 1, LIB))).toEqual(['bass', 'kicks'])
  })

  it('после интро (loopIndex 2): вступают lead и sfx', () => {
    expect(rolesOf(d.compose(42, 2, LIB))).toEqual(['bass', 'kicks', 'lead', 'sfx'])
  })

  it('все stemId существуют в библиотеке', () => {
    const all = new Set(Object.values(LIB).flat().map(s => s.id))
    for (const v of d.compose(7, 9, LIB)) expect(all.has(v.stemId)).toBe(true)
  })

  it('у каждого голоса положительный gain', () => {
    for (const v of d.compose(7, 2, LIB)) expect(v.gain).toBeGreaterThan(0)
  })
})
