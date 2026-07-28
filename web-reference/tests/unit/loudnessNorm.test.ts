import { describe, it, expect } from 'vitest'
import { normGainFor } from '../../src/game/audio/WebAudioMusicEngine'

// Normalizes stem loudness to the target level + peak ceiling.
describe('normGainFor — stem loudness normalization', () => {
  it('quiet stem is boosted, loud one is attenuated', () => {
    expect(normGainFor(0.02, 0.10)).toBeGreaterThan(1)   // quiet lead → boost
    expect(normGainFor(0.40, 0.60)).toBeLessThan(1)       // loud → down
  })

  it('peak is not let past the ceiling (anti-"hurts the ears")', () => {
    const g = normGainFor(0.02, 0.99)   // quiet by RMS, but peak at the ceiling
    expect(g * 0.99).toBeLessThanOrEqual(0.9 + 1e-9)
  })

  it('silence (rms 0) → coefficient 1 (no division by zero)', () => {
    expect(normGainFor(0, 0)).toBe(1)
  })
})
