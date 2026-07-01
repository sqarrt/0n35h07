import { describe, it, expect } from 'vitest'
import { DRUM_COLORS, kickColorChain } from '../../src/radio/music/radio/engines/drumColor'

describe('drumColor', () => {
  it('ids unique, ≥6 colours', () => {
    expect(new Set(DRUM_COLORS.map((c) => c.id)).size).toBe(DRUM_COLORS.length)
    expect(DRUM_COLORS.length).toBeGreaterThanOrEqual(6)
  })
  it('kickColorChain always sets shape and is method-suffix shaped', () => {
    for (const c of DRUM_COLORS) {
      const chain = kickColorChain(c)
      expect(chain.startsWith('.shape(')).toBe(true)
      expect(chain.includes('NaN')).toBe(false)
    }
  })
  it('drive/decay/lpf appear only when defined', () => {
    expect(kickColorChain({ id: 't', kickShape: 0.2 })).toBe('.shape(0.2)')
    expect(kickColorChain({ id: 'd', kickShape: 0.2, kickDecay: 0.18, kickLpf: 1200 })).toBe('.shape(0.2).decay(0.18).lpf(1200)')
  })
})
