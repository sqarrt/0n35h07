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
  it('форматирует строку mood_bpmbpm_xxxx', () => {
    expect(radioTrackName(BASE)).toMatch(/^dark_techno_124bpm_[0-9a-f]{4}$/)
  })

  it('разные trackSeed дают разные суффиксы', () => {
    const a = radioTrackName(BASE)
    const b = radioTrackName({ ...BASE, trackSeed: 'abc:t1', trackIndex: 1 })
    expect(a).not.toBe(b)
  })

  it('mood из состояния используется как префикс', () => {
    expect(radioTrackName({ ...BASE, mood: 'dub_techno', bpm: 118 }))
      .toMatch(/^dub_techno_118bpm_/)
  })
})
