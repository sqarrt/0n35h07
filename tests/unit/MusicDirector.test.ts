import { describe, it, expect } from 'vitest'
import { MusicDirector } from '../../src/game/audio/MusicDirector'
import type { StemLibrary } from '../../src/game/audio/types'

// Synthetic library — the tests don't depend on real assets.
const LIB: StemLibrary = {
  bass:  Array.from({ length: 4 }, (_, i) => ({ id: `bass/b${i}`, url: `b${i}` })),
  kicks: Array.from({ length: 6 }, (_, i) => ({ id: `kicks/k${i}`, url: `k${i}` })),
  lead:  Array.from({ length: 6 }, (_, i) => ({ id: `lead/l${i}`, url: `l${i}` })),
  sfx:   Array.from({ length: 4 }, (_, i) => ({ id: `sfx/s${i}`, url: `s${i}` })),
}
const FAR = 10 * 60_000        // far from the match end → not outro
const OUTRO = 5_000            // ≤ OUTRO_MS → outro
const rolesOf = (arr: { role: string }[]) => arr.map(v => v.role).sort()
const leadId = (arr: { role: string; stemId: string }[]) => arr.find(v => v.role === 'lead')!.stemId
const d = new MusicDirector()

describe('MusicDirector.compose — song form', () => {
  it('deterministic: same inputs → same arrangement', () => {
    expect(d.compose(42, 9, LIB, FAR)).toEqual(d.compose(42, 9, LIB, FAR))
  })

  it('intro: kicks+bass; the kick anchor is stable, the bass changes', () => {
    for (const loop of [0, 1, 2, 3]) expect(rolesOf(d.compose(42, loop, LIB, FAR))).toEqual(['bass', 'kicks'])
    const kick = (l: number) => d.compose(42, l, LIB, FAR).find(v => v.role === 'kicks')!.stemId
    const bass = (l: number) => d.compose(42, l, LIB, FAR).find(v => v.role === 'bass')!.stemId
    expect(kick(0)).toBe(kick(3))                                   // kick is the anchor, stable across the whole intro
    expect(new Set([0, 1, 2, 3].map(bass)).size).toBeGreaterThan(1) // bass isn't a single one for the whole intro
  })

  it('bass does not play for more than 2 loops in a row', () => {
    const bass = (l: number) => d.compose(42, l, LIB, FAR).find(v => v.role === 'bass')?.stemId
    for (let l = 0; l <= 58; l++) {
      const a = bass(l), b = bass(l + 1), c = bass(l + 2)
      if (a !== undefined && a === b && a === c) throw new Error(`bass stuck on loops ${l}..${l + 2}`)
    }
  })

  it('outro by remaining time: kicks+lead (regardless of loopIndex)', () => {
    expect(rolesOf(d.compose(42, 100, LIB, OUTRO))).toEqual(['kicks', 'lead'])
  })

  it('outro takes the chorus lead (variant 0)', () => {
    // first chorus: intro(4)+verse(4) → abs. loops 8..11, occurrence 0, variant 0
    expect(leadId(d.compose(42, 200, LIB, OUTRO))).toBe(leadId(d.compose(42, 9, LIB, FAR)))
  })

  it('body sections: correct role sets', () => {
    expect(rolesOf(d.compose(42, 4, LIB, FAR))).toEqual(['bass', 'kicks', 'lead', 'sfx'])   // verse (abs 4..7)
    expect(rolesOf(d.compose(42, 20, LIB, FAR))).toEqual(['bass', 'sfx'])                    // bridge (abs 20..21)
    expect(rolesOf(d.compose(42, 22, LIB, FAR))).toEqual(['kicks', 'lead'])                  // solo (abs 22..25)
  })

  it('variation: verses rotate the lead through the pool (occ0≠occ1, occ0==occ3)', () => {
    // verses on abs. loops 4(occ0),12(occ1),30(occ2),38(occ3); take the 2nd loop of the section (1st — lead pause)
    const o0 = leadId(d.compose(42, 5, LIB, FAR))
    const o1 = leadId(d.compose(42, 13, LIB, FAR))
    const o3 = leadId(d.compose(42, 39, LIB, FAR))
    expect(o0).not.toBe(o1)   // adjacent repeats — different variants
    expect(o0).toBe(o3)       // pool period (COLOR_POOL=3) → occ0 and occ3 coincide
  })

  it('bass does not get stuck: changes per section (several distinct ones occur over a match)', () => {
    const bassId = (loop: number) => d.compose(42, loop, LIB, FAR).find(v => v.role === 'bass')!.stemId
    // intro(0), verse(4), chorus(8), bridge(20) — all with bass, but different sections
    const distinct = new Set([0, 4, 8, 20].map(bassId))
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('lead and bass do not swap at the same time (when both play) on any loop', () => {
    const lead = (l: number) => d.compose(42, l, LIB, FAR).find(v => v.role === 'lead')?.stemId ?? null
    const bass = (l: number) => d.compose(42, l, LIB, FAR).find(v => v.role === 'bass')?.stemId ?? null
    for (let l = 1; l <= 60; l++) {
      const lp = lead(l - 1), lc = lead(l), bp = bass(l - 1), bc = bass(l)
      const leadSwapped = lp !== null && lc !== null && lp !== lc   // both loops have a playing lead, the stem changed
      const bassSwapped = bp !== null && bc !== null && bp !== bc   // (role entering/leaving at a section boundary isn't a "swap")
      expect(leadSwapped && bassSwapped, `loop ${l}: lead and bass swapped at the same time`).toBe(false)
    }
  })

  it('between different leads there is a pause ≥1 loop (no seamless lead→lead transition)', () => {
    const hasLead = (l: number) => d.compose(42, l, LIB, FAR).some(v => v.role === 'lead')
    // verse(4-7) → chorus(8-11): the first chorus loop (8) has no lead (pause), the lead enters from the 9th
    expect(hasLead(7)).toBe(true)    // end of the verse — lead plays
    expect(hasLead(8)).toBe(false)   // first chorus loop — pause
    expect(hasLead(9)).toBe(true)    // chorus lead has entered
  })

  it('no direct transition between two DIFFERENT leads (a pause first)', () => {
    const primary = (l: number) => {
      const ls = d.compose(42, l, LIB, FAR).filter(v => v.role === 'lead')
      return ls.length ? ls[0].stemId : null   // the section's main lead (the ornament is the second, comes after)
    }
    for (let l = 5; l <= 60; l++) {
      const a = primary(l - 1), b = primary(l)
      if (a !== null && b !== null && a !== b) throw new Error(`direct lead transition on loop ${l}: ${a}→${b}`)
    }
  })

  it('verse lead and chorus lead differ (section recognizability)', () => {
    expect(leadId(d.compose(42, 4, LIB, FAR))).not.toBe(leadId(d.compose(42, 9, LIB, FAR)))  // 8 — pause, take 9
  })

  it('ornament: on the last chorus loop — a second (distinct) lead, in the middle — one', () => {
    const leads = (loop: number) => d.compose(42, loop, LIB, FAR).filter(v => v.role === 'lead')
    expect(leads(9).length).toBe(1)             // middle of the chorus (8 — pause) — one lead
    expect(leads(11).length).toBe(2)            // last chorus loop (abs 11) — a second lead added
    expect(new Set(leads(11).map(v => v.stemId)).size).toBe(2)   // two different leads
  })

  it('all stemIds exist in the library; gain is positive', () => {
    const all = new Set(Object.values(LIB).flat().map(s => s.id))
    for (const v of d.compose(7, 9, LIB, FAR)) {
      expect(all.has(v.stemId)).toBe(true)
      expect(v.gain).toBeGreaterThan(0)
    }
  })
})
