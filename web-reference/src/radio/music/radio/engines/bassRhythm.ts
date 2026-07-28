import type { MoodTagged } from './leadAxes'

// РИСУНОК axis: a 16-step mask — 'x' onset, '_' sustain (hold the previous note), '~' rest. BASS LAW: never all
// rest. Optional 16-step `accent` = a per-step gain pattern (migrated from the voices that carried .gain("…")).
export interface BassRhythm extends MoodTagged { mask: string; accent?: string }
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
const ACCENT_A = '1 0.45 0.6 0.5 1 0.45 0.6 0.5 1 0.45 0.7 0.5 1 0.45 0.6 0.5'
const ACCENT_B = '1 0.5 0.7 0.5 1 0.5 0.7 0.5 1 0.5 0.7 0.5 1 0.5 0.7 0.5'
export const BASS_RHYTHMS: BassRhythm[] = [
  { id: 'driving16', mask: 'x x x x x x x x x x x x x x x x' },
  { id: 'straight8', mask: 'x ~ x ~ x ~ x ~ x ~ x ~ x ~ x ~' },
  { id: 'offbeat', mask: '~ x ~ x ~ x ~ x ~ x ~ x ~ x ~ x' },
  { id: 'electro', mask: 'x ~ ~ x x ~ ~ x x ~ ~ x x ~ ~ x' },
  { id: 'rolling', mask: 'x x ~ x x x ~ x x x ~ x x x ~ x', accent: ACCENT_B },
  { id: 'dubSparse', mask: 'x ~ ~ ~ x ~ ~ x ~ ~ x ~ x ~ ~ ~', moods: CALM },
  { id: 'tripletFeel', mask: 'x x x ~ x x x ~ x x x ~ x x x ~' },
  { id: 'sustained', mask: 'x _ _ x _ x _ _ x _ _ x _ x _ _', moods: CALM },
  { id: 'accent16', mask: 'x x x x x x x x x x x x x x x x', accent: ACCENT_A, moods: HARD },
]
export function bassOnsets(r: { mask: string }): boolean[] { return r.mask.trim().split(/\s+/).map((t) => t === 'x') }
