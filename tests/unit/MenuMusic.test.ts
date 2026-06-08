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
}

const KICK = 'kicks/sub_long'
const BASS = 'bass/kutting'
const COLORS = ['lead/crickets_tex', 'lead/lwt_14']

function arrangements(seed: number, loops: number) {
  const m = new MenuMusic(new FakeEngine(), mulberry32(seed))
  return Array.from({ length: loops }, (_, i) => m.arrange(i))
}

describe('MenuMusic.arrange', () => {
  it('фундамент звучит каждый луп: kick sub_long + bass kutting', () => {
    for (const arr of arrangements(1, 40)) {
      const ids = arr.map(v => v.stemId)
      expect(ids).toContain(KICK)
      expect(ids).toContain(BASS)
    }
  })

  it('каждый цветной слой иногда звучит, но НЕ всегда (независимо)', () => {
    const arrs = arrangements(123, 200)
    for (const color of COLORS) {
      const onCount = arrs.filter(a => a.some(v => v.stemId === color)).length
      expect(onCount).toBeGreaterThan(0)        // иногда включается
      expect(onCount).toBeLessThan(arrs.length) // но не постоянно
    }
  })

  it('цветные слои независимы: бывают лупы с обоими и лупы без цветных', () => {
    const arrs = arrangements(123, 300)
    const hasBoth = arrs.some(a => COLORS.every(c => a.some(v => v.stemId === c)))
    const hasNone = arrs.some(a => COLORS.every(c => !a.some(v => v.stemId === c)))
    expect(hasBoth).toBe(true)
    expect(hasNone).toBe(true)
  })

  it('все голоса валидны: gain>0, роли заданы', () => {
    for (const v of arrangements(7, 30).flat()) {
      expect(v.gain).toBeGreaterThan(0)
      expect(['kicks', 'bass', 'lead']).toContain(v.role)
    }
  })

  it('детерминирован при одном сиде', () => {
    expect(arrangements(42, 20)).toEqual(arrangements(42, 20))
  })
})
