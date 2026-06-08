import { describe, it, expect } from 'vitest'
import { MusicDirector } from '../../src/game/audio/MusicDirector'
import type { StemLibrary } from '../../src/game/audio/types'

// Синтетическая библиотека — тесты не зависят от реальных ассетов.
const LIB: StemLibrary = {
  bass:  Array.from({ length: 4 }, (_, i) => ({ id: `bass/b${i}`, url: `b${i}` })),
  kicks: Array.from({ length: 6 }, (_, i) => ({ id: `kicks/k${i}`, url: `k${i}` })),
  lead:  Array.from({ length: 6 }, (_, i) => ({ id: `lead/l${i}`, url: `l${i}` })),
  sfx:   Array.from({ length: 4 }, (_, i) => ({ id: `sfx/s${i}`, url: `s${i}` })),
}
const FAR = 10 * 60_000        // далеко до конца матча → не аутро
const OUTRO = 5_000            // ≤ OUTRO_MS → аутро
const rolesOf = (arr: { role: string }[]) => arr.map(v => v.role).sort()
const leadId = (arr: { role: string; stemId: string }[]) => arr.find(v => v.role === 'lead')!.stemId
const d = new MusicDirector()

describe('MusicDirector.compose — песенная форма', () => {
  it('детерминирован: одинаковые входы → одинаковая аранжировка', () => {
    expect(d.compose(42, 9, LIB, FAR)).toEqual(d.compose(42, 9, LIB, FAR))
  })

  it('интро: kicks+bass; кик-опора стабилен, бас меняется каждые 2 лупа', () => {
    for (const loop of [0, 1, 2, 3]) expect(rolesOf(d.compose(42, loop, LIB, FAR))).toEqual(['bass', 'kicks'])
    const kick = (l: number) => d.compose(42, l, LIB, FAR).find(v => v.role === 'kicks')!.stemId
    const bass = (l: number) => d.compose(42, l, LIB, FAR).find(v => v.role === 'bass')!.stemId
    expect(kick(0)).toBe(kick(3))      // кик — опора, стабилен весь интро
    expect(bass(0)).toBe(bass(1))      // первый 2-луповый блок
    expect(bass(0)).not.toBe(bass(2))  // смена баса на 3-м лупе
    expect(bass(2)).toBe(bass(3))      // второй блок
  })

  it('бас не звучит дольше 2 лупов подряд: смена внутри куплета и припева', () => {
    const bass = (l: number) => d.compose(42, l, LIB, FAR).find(v => v.role === 'bass')!.stemId
    // куплет абс 4..7
    expect(bass(4)).toBe(bass(5)); expect(bass(4)).not.toBe(bass(6)); expect(bass(6)).toBe(bass(7))
    // припев абс 8..11
    expect(bass(8)).toBe(bass(9)); expect(bass(8)).not.toBe(bass(10)); expect(bass(10)).toBe(bass(11))
  })

  it('аутро по остатку времени: kicks+lead (независимо от loopIndex)', () => {
    expect(rolesOf(d.compose(42, 100, LIB, OUTRO))).toEqual(['kicks', 'lead'])
  })

  it('аутро берёт лид припева (вариант 0)', () => {
    // первый припев: интро(4)+куплет(4) → абс. лупы 8..11, occurrence 0, вариант 0
    expect(leadId(d.compose(42, 200, LIB, OUTRO))).toBe(leadId(d.compose(42, 9, LIB, FAR)))
  })

  it('секции тела: верные наборы ролей', () => {
    expect(rolesOf(d.compose(42, 4, LIB, FAR))).toEqual(['bass', 'kicks', 'lead', 'sfx'])   // куплет (абс 4..7)
    expect(rolesOf(d.compose(42, 20, LIB, FAR))).toEqual(['bass', 'sfx'])                    // бридж (абс 20..21)
    expect(rolesOf(d.compose(42, 22, LIB, FAR))).toEqual(['kicks', 'lead'])                  // соло (абс 22..25)
  })

  it('вариация: куплеты ротируют лид по пулу (occ0≠occ1, occ0==occ3)', () => {
    // куплеты начинаются на абс. лупах: 4 (occ0), 12 (occ1), затем +26: 30 (occ2), 38 (occ3)
    const o0 = leadId(d.compose(42, 4, LIB, FAR))
    const o1 = leadId(d.compose(42, 12, LIB, FAR))
    const o3 = leadId(d.compose(42, 38, LIB, FAR))
    expect(o0).not.toBe(o1)   // соседние повторы — разные варианты
    expect(o0).toBe(o3)       // период пула (COLOR_POOL=3) → occ0 и occ3 совпадают
  })

  it('бас не залипает: меняется по секциям (за матч встречается несколько разных)', () => {
    const bassId = (loop: number) => d.compose(42, loop, LIB, FAR).find(v => v.role === 'bass')!.stemId
    // интро(0), куплет(4), припев(8), бридж(20) — все с басом, но разные секции
    const distinct = new Set([0, 4, 8, 20].map(bassId))
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('лид куплета и лид припева различны (узнаваемость секций)', () => {
    expect(leadId(d.compose(42, 4, LIB, FAR))).not.toBe(leadId(d.compose(42, 8, LIB, FAR)))
  })

  it('орнамент: на последнем лупе припева — второй (отличный) лид, в середине — один', () => {
    const leads = (loop: number) => d.compose(42, loop, LIB, FAR).filter(v => v.role === 'lead')
    expect(leads(8).length).toBe(1)             // начало первого припева (абс 8) — один лид
    expect(leads(11).length).toBe(2)            // последний луп припева (абс 11) — добавлен второй лид
    expect(new Set(leads(11).map(v => v.stemId)).size).toBe(2)   // два разных лида
  })

  it('все stemId существуют в библиотеке; gain положительный', () => {
    const all = new Set(Object.values(LIB).flat().map(s => s.id))
    for (const v of d.compose(7, 9, LIB, FAR)) {
      expect(all.has(v.stemId)).toBe(true)
      expect(v.gain).toBeGreaterThan(0)
    }
  })
})
