import { describe, it, expect } from 'vitest'
import { BG_STRUCTS, BG_MELODIES, BG_TIMBRES, bgAccentBody } from '../../src/radio/music/radio/engines/bgAccent'

describe('bgAccent', () => {
  it('pools non-empty, ids unique', () => {
    expect(BG_STRUCTS.length).toBeGreaterThanOrEqual(4)
    expect(new Set(BG_MELODIES.map((m) => m.id)).size).toBe(BG_MELODIES.length)
    expect(new Set(BG_TIMBRES.map((t) => t.id)).size).toBe(BG_TIMBRES.length)
    expect(BG_MELODIES.length).toBeGreaterThanOrEqual(4)
    expect(BG_TIMBRES.length).toBeGreaterThanOrEqual(4)
  })
  it('single-offset melody → note+struct+timbre', () => {
    const body = bgAccentBody('x ~ ~ ~', { id: 'm', offs: [7] }, { id: 't', fx: '.s("sine").decay(0.4)' }, 40)
    expect(body).toBe('note("47").struct("x ~ ~ ~").s("sine").decay(0.4)')
  })
  it('arp melody → a slowed note sequence, no struct', () => {
    const body = bgAccentBody('x ~ ~ ~', { id: 'a', offs: [0, 7], arp: true }, { id: 't', fx: '.s("sine")' }, 40)
    expect(body).toBe('note("40 47").slow(2).s("sine")')
  })
})
