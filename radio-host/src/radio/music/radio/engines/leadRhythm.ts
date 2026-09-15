import type { MoodTagged } from './leadAxes'

// РИСУНОК axis: where the lead speaks (x), breathes (~), or doubles into a 16th sub-pair (xx), over a 4-bar
// phrase at 8th-note resolution. gate = note length 0..1 (combiner default 0.5). Only EXTREME masks carry `moods`.
export interface LeadRhythm extends MoodTagged { bars: string[]; gate?: number }
export type Slot = 'onset' | 'rest' | 'pair'

const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']

export const LEAD_RHYTHMS: LeadRhythm[] = [
  { id: 'sparseCall', bars: ['x ~ ~ x ~ ~ x ~', '~ x ~ ~ ~ ~ ~ ~', 'x ~ ~ x ~ ~ x ~', '~ ~ ~ ~ ~ ~ ~ ~'] },
  { id: 'ballad', bars: ['x ~ ~ ~ x ~ ~ ~', '~ ~ ~ ~ ~ ~ ~ ~', 'x ~ ~ x ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~ ~'], gate: 0.9 },
  { id: 'bell', bars: ['x ~ ~ x ~ x ~ ~', '~ ~ x ~ x ~ x ~', '~ x ~ x ~ ~ x ~', 'x ~ x ~ ~ ~ ~ ~'] },
  { id: 'pulse', bars: ['x ~ ~ x ~ x ~ ~', 'x ~ x ~ ~ x ~ ~', 'x ~ ~ x ~ x ~ ~', 'x ~ x ~ ~ x ~ ~'] },
  { id: 'sync', bars: ['~ x ~ x x ~ x ~', '~ x ~ ~ x ~ x ~', '~ x ~ x x ~ x ~', '~ x ~ ~ x ~ ~ ~'] },
  { id: 'gallop', bars: ['xx ~ x xx ~ x xx ~', 'x xx ~ x xx ~ x ~', 'xx ~ x xx ~ x xx ~', 'x xx ~ x ~ x ~ ~'], moods: HARD },
  { id: 'dense16', bars: ['xx xx x xx x xx x x', 'x xx x xx xx x xx x', 'xx x xx x x xx x xx', 'x xx x x xx x ~ ~'], moods: [...HARD, 'dark_hypnotic'] },
  { id: 'airy', bars: ['x ~ ~ ~ ~ ~ ~ ~', '~ ~ x ~ ~ ~ ~ ~', '~ ~ ~ ~ x ~ ~ ~', '~ ~ ~ ~ ~ ~ ~ ~'], gate: 0.95, moods: CALM },
  { id: 'stutter', bars: ['x ~ x ~ x ~ ~ x', 'x ~ ~ x ~ x ~ ~', 'x ~ x ~ x ~ ~ x', 'x ~ ~ x ~ ~ ~ ~'] },
  { id: 'echoRest', bars: ['x ~ x ~ ~ ~ ~ ~', '~ ~ ~ ~ x ~ x ~', '~ ~ x ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~ ~'], gate: 0.8 },
]

const SUBPAIR = 'xx'
const ONSET = 'x'

/** Parse each bar string into a per-slot list (onset / rest / pair). */
export function rhythmOnsets(r: { bars: string[] }): Slot[][] {
  return r.bars.map((bar) => bar.trim().split(/\s+/).map((t) => (t === SUBPAIR ? 'pair' : t === ONSET ? 'onset' : 'rest')))
}
/** Total notes the rhythm wants (a pair = 2). */
export function onsetCount(r: { bars: string[] }): number {
  return rhythmOnsets(r).flat().reduce((n, s) => n + (s === 'pair' ? 2 : s === 'onset' ? 1 : 0), 0)
}
