import { describe, it, expect } from 'vitest'
import { radioTrackName } from '../../src/radio/trackName'
import type { MusicalState } from '../../src/radio/music/radio/MusicalState'

const BASE: MusicalState = {
  seed: 'abc', trackIndex: 0, trackSeed: 'abc:t0', strudelCode: '',
  mood: 'dark_techno', sectionsUntilMoodChange: 8,
  key: 'E', scaleName: 'phrygian', chord: 'Em7',
  section: 'drop', sectionBars: 8, bpm: 124, bar: 0,
  layers: { kicks: true, bass: true, lead: false, bg: false, perc: false },
}

describe('radioTrackName', () => {
  it('deterministic: the same track always yields the same name', () => {
    expect(radioTrackName(BASE)).toBe(radioTrackName(BASE))
  })

  it('human-readable — NOT the old mood_bpm format', () => {
    const n = radioTrackName(BASE)
    expect(n.length).toBeGreaterThan(0)
    expect(n).not.toMatch(/_\d+bpm_/)
  })

  it('varies across track seeds', () => {
    const names = new Set(Array.from({ length: 12 }, (_, i) => radioTrackName({ ...BASE, trackSeed: `abc:t${i}` })))
    expect(names.size).toBeGreaterThan(1)
  })

  it('exercises the many schemes across many seeds', () => {
    const many = Array.from({ length: 160 }, (_, i) => radioTrackName({ ...BASE, trackSeed: `s${i}` }))
    expect(many.some(n => /PROTOCOL:|proc\/|SYS\.|daemon:/.test(n))).toBe(true)   // protocol scheme
    expect(many.some(n => /(\/\/|\[|·|\/\d)/.test(n))).toBe(true)                  // hybrid tag / compound scheme
    expect(many.some(n => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(n))).toBe(true)         // plain two-word scheme
    expect(many.some(n => /^The /.test(n))).toBe(true)                             // definite-article title scheme
    expect(many.some(n => /No\.\d|no\.\d|·\d/.test(n))).toBe(true)                 // catalogue-index scheme
  })
})
