import { describe, it, expect } from 'vitest'
import { buildBias } from '../../src/radio/bias'
import type { TrackDescriptor } from '../../src/radio/trackDescriptor'

const t = (mood: string, over: Partial<TrackDescriptor> = {}): TrackDescriptor => ({
  seed: 'S', index: 0, mood, key: 'C', scaleName: 'minor', bpm: 120,
  style: { kick: 'a', bass: 'b', lead: 'c', bg: 'd', perc: 'e' }, ...over,
})

describe('buildBias', () => {
  it('neutral (weight 1) with no preferences', () => {
    expect(buildBias([], []).weightFor('mood', 'dark')).toBe(1)
  })

  it('dislikes push a value below 1, bounded at the floor', () => {
    const b = buildBias([], [t('dark'), t('dark'), t('dark')])
    const w = b.weightFor('mood', 'dark')
    expect(w).toBeLessThan(1)
    expect(w).toBeGreaterThanOrEqual(0.05)
  })

  it('favorites lift a value above 1, bounded at the cap', () => {
    const b = buildBias([t('dub'), t('dub'), t('dub'), t('dub'), t('dub'), t('dub')], [])
    const w = b.weightFor('mood', 'dub')
    expect(w).toBeGreaterThan(1)
    expect(w).toBeLessThanOrEqual(3)
  })

  it('untouched values stay neutral', () => {
    expect(buildBias([], [t('dark')]).weightFor('mood', 'acid')).toBe(1)
  })

  it('biases style attributes too (kick/bass/lead/bg/perc/key/scale)', () => {
    const b = buildBias([], [t('x', { scaleName: 'phrygian', style: { kick: 'k9', bass: 'b', lead: 'c', bg: 'd', perc: 'e' } })])
    expect(b.weightFor('scale', 'phrygian')).toBeLessThan(1)
    expect(b.weightFor('kick', 'k9')).toBeLessThan(1)
    expect(b.weightFor('kick', 'other')).toBe(1)
  })
})
