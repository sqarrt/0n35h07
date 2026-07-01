import type { MoodTagged } from './leadAxes'

// ЦВЕТ axis (note 4): the per-track kick/drum PROCESSING character. Noticeable but in-genre. kickColorChain builds
// the Strudel suffix; the composer appends the section/mood modulation (gain envelope, muffle, peak) AROUND it.
export interface DrumColor extends MoodTagged {
  kickShape: number; kickDrive?: string; kickDecay?: number; kickLpf?: number; kickClick?: boolean
  drumShape?: number; room?: number
}
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
export const DRUM_COLORS: DrumColor[] = [
  { id: 'punchy', kickShape: 0.22, kickClick: true, drumShape: 0.06 },
  { id: 'boomySub', kickShape: 0.12, kickDecay: 0.26, kickLpf: 700, drumShape: 0.04, moods: [...CALM, 'dark_techno'] },
  { id: 'crunchy', kickShape: 0.38, kickDrive: '1.3:0.35', drumShape: 0.12, moods: HARD },
  { id: 'tightDry', kickShape: 0.18, kickDecay: 0.1, kickClick: true },
  { id: 'lofiCrush', kickShape: 0.3, kickDrive: '1.2:0.3', kickLpf: 1500, drumShape: 0.1, room: 0.12, moods: HARD },
  { id: 'gatedShort', kickShape: 0.26, kickDecay: 0.08, kickLpf: 2000, kickClick: true },
  { id: 'roundWarm', kickShape: 0.1, kickDecay: 0.2, kickLpf: 900, room: 0.08, moods: CALM },
  { id: 'hardDrive', kickShape: 0.34, kickDrive: '1.4:0.4', kickClick: true, drumShape: 0.14, moods: HARD },
]
const CLICK_SUFFIX = '.attack(0.001)' // a hard, immediate transient (no soft fade) reads as punch
/** The kick's colour suffix: shape, optional drive/decay/lpf/click. Order is fixed for snapshot stability. */
export function kickColorChain(c: DrumColor): string {
  let s = `.shape(${c.kickShape})`
  if (c.kickDrive) s += `.distort("${c.kickDrive}")`
  if (c.kickDecay !== undefined) s += `.decay(${c.kickDecay})`
  if (c.kickLpf !== undefined) s += `.lpf(${c.kickLpf})`
  if (c.kickClick) s += CLICK_SUFFIX
  return s
}
