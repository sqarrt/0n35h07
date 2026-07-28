import { describe, it, expect } from 'vitest'
import { combineBass } from '../../src/radio/music/radio/engines/combineBass'

describe('combineBass', () => {
  it('places offsets on onsets, _ on sustain, ~ on rest', () => {
    const r = { mask: 'x _ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~' }
    expect(combineBass(r, [0, 6])).toBe('0 _ ~ 6 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~')
  })
  it('loops the offset contour across onsets', () => {
    const r = { mask: 'x x x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~' }
    expect(combineBass(r, [0, 5]).startsWith('0 5 0 ~')).toBe(true)
  })
  it('always returns 16 tokens', () => {
    expect(combineBass({ mask: 'x x x x x x x x x x x x x x x x' }, [0]).split(' ').length).toBe(16)
  })
})
