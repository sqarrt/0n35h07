import { describe, it, expect } from 'vitest'
import { normGainFor } from '../../src/game/audio/WebAudioMusicEngine'

// Нормализация громкости стема к целевому уровню + пик-потолок.
describe('normGainFor — нормализация громкости стема', () => {
  it('тихий стем усиливается, громкий — ослабляется', () => {
    expect(normGainFor(0.02, 0.10)).toBeGreaterThan(1)   // тихий лид → буст
    expect(normGainFor(0.40, 0.60)).toBeLessThan(1)       // громкий → вниз
  })

  it('пик не выпускается за потолок (анти-«бьёт по ушам»)', () => {
    const g = normGainFor(0.02, 0.99)   // тихий по RMS, но пик у потолка
    expect(g * 0.99).toBeLessThanOrEqual(0.9 + 1e-9)
  })

  it('тишина (rms 0) → коэффициент 1 (без деления на ноль)', () => {
    expect(normGainFor(0, 0)).toBe(1)
  })
})
