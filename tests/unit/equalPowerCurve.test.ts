import { describe, it, expect } from 'vitest'
import { equalPowerCurve } from '../../src/game/audio/WebAudioMusicEngine'

// Anti-click: EVERY gain curve must start at zero, otherwise a fresh source
// starting to play with a non-zero buffer[0] at full gain causes a signal discontinuity = click.
describe('equalPowerCurve — edges start/end at zero (de-click)', () => {
  it('in: 0 → gain', () => {
    const c = equalPowerCurve(0.8, 'in')
    expect(c[0]).toBe(0)
    expect(c[c.length - 1]).toBeCloseTo(0.8, 5)
  })

  it('out: 0 (de-click of fresh tail start) → 0', () => {
    const c = equalPowerCurve(0.8, 'out')
    expect(c[0]).toBe(0)                          // not full at buffer[0] — otherwise a click
    expect(c[c.length - 1]).toBeCloseTo(0, 5)
  })
})
