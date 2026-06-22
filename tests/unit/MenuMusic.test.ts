import { describe, it, expect } from 'vitest'
import { MenuMusic } from '../../src/game/audio/MenuMusic'
import { mulberry32 } from '../../src/game/audio/rng'
import type { IMusicEngine, Arrangement, StemLibrary } from '../../src/game/audio/types'

class FakeEngine implements IMusicEngine {
  loopIndex = 0
  async load(_lib: StemLibrary) {}
  async start(_p: (i: number) => Arrangement) {}
  fadeOut() {}
  stop() {}
  setMasterGain() {}
  dispose() {}
  activeStemIds() { return [] }
  readLevel() { return 0 }
  readBands() {}
}

const KICK = 'kicks/sub_long'
const BASS = 'bass/kutting'
const COLORS = ['lead/crickets_tex', 'lead/lwt_14']

function arrangements(seed: number, loops: number) {
  const m = new MenuMusic(new FakeEngine(), mulberry32(seed))
  return Array.from({ length: loops }, (_, i) => m.arrange(i))
}

/** Max consecutive loops where pred(loop) is true. */
function maxRun(arrs: { stemId: string }[][], pred: (a: { stemId: string }[]) => boolean): number {
  let max = 0, cur = 0
  for (const a of arrs) { cur = pred(a) ? cur + 1 : 0; if (cur > max) max = cur }
  return max
}

describe('MenuMusic.arrange', () => {
  it('sub_long kick plays every loop (constant foundation)', () => {
    for (const arr of arrangements(1, 40)) {
      expect(arr.map(v => v.stemId)).toContain(KICK)
    }
  })

  it('kutting bass occasionally drops out, but plays in most loops', () => {
    const arrs = arrangements(123, 200)
    const onCount = arrs.filter(a => a.some(v => v.stemId === BASS)).length
    expect(onCount).toBeLessThan(arrs.length)   // occasional pauses
    expect(onCount).toBeGreaterThan(arrs.length / 2)   // but mostly playing
  })

  it('bass rests for no more than 1 loop in a row (pauses do not clump)', () => {
    for (const seed of [1, 42, 123, 777, 9001]) {
      const arrs = arrangements(seed, 300)
      const maxOff = maxRun(arrs, a => !a.some(v => v.stemId === BASS))
      expect(maxOff).toBeLessThanOrEqual(1)
    }
  })

  it('no lead plays for more than 2 loops in a row', () => {
    for (const seed of [1, 42, 123, 777, 9001]) {
      const arrs = arrangements(seed, 300)
      for (const color of COLORS) {
        const maxOn = maxRun(arrs, a => a.some(v => v.stemId === color))
        expect(maxOn).toBeLessThanOrEqual(2)
      }
    }
  })

  it('each color layer plays sometimes, but NOT always (independently)', () => {
    const arrs = arrangements(123, 200)
    for (const color of COLORS) {
      const onCount = arrs.filter(a => a.some(v => v.stemId === color)).length
      expect(onCount).toBeGreaterThan(0)        // turns on sometimes
      expect(onCount).toBeLessThan(arrs.length) // but not constantly
    }
  })

  it('color layers are independent: there are loops with both and loops with none', () => {
    const arrs = arrangements(123, 300)
    const hasBoth = arrs.some(a => COLORS.every(c => a.some(v => v.stemId === c)))
    const hasNone = arrs.some(a => COLORS.every(c => !a.some(v => v.stemId === c)))
    expect(hasBoth).toBe(true)
    expect(hasNone).toBe(true)
  })

  it('all voices are valid: gain>0, roles set', () => {
    for (const v of arrangements(7, 30).flat()) {
      expect(v.gain).toBeGreaterThan(0)
      expect(['kicks', 'bass', 'lead']).toContain(v.role)
    }
  })

  it('deterministic for a given seed', () => {
    expect(arrangements(42, 20)).toEqual(arrangements(42, 20))
  })
})
