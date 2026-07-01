import { describe, it, expect } from 'vitest'
import { combineLead } from '../../src/radio/music/radio/engines/leadCombine'
import { onsetCount } from '../../src/radio/music/radio/engines/leadRhythm'

const id = (d: number) => d            // identity deg for assertions
describe('combineLead', () => {
  it('places notes on onsets, ~ on rests, in <…> bars', () => {
    const r = { id: 'r', bars: ['x ~ x ~', '~ ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~'] }
    const out = combineLead(r, [10, 20], id)  // 2 onsets
    expect(out).toBe('<[10 ~ 20 ~] [~ ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~]>')
  })
  it('a pair consumes two els as a 16th sub-group', () => {
    const r = { id: 'p', bars: ['xx ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~'] }
    expect(combineLead(r, [1, 2], id)).toBe('<[[1 2] ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~]>')
  })
  it('renders stacks via deg', () => {
    const r = { id: 's', bars: ['x ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~'] }
    expect(combineLead(r, [[0, 2]], id)).toBe('<[[0,2] ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~]>')
  })
  it('consumes exactly onsetCount elements', () => {
    const r = { id: 'c', bars: ['x x ~ ~', 'x ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~'] }
    expect(onsetCount(r)).toBe(3)
    expect(() => combineLead(r, [1, 2, 3], id)).not.toThrow()
  })
})
