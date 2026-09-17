import type { Rng } from '../../seededRandom'
import type { MoodTagged } from './leadAxes'

// МЕЛОДИЯ axis: a stream of scale DEGREES (looped contour or generative strategy), then VOICED into single notes
// or stacks (this is where dyads/triads live — "which notes"). Degrees map to MIDI later via the combiner's `deg`.
export type MelEl = number | number[]
export interface LeadMelody extends MoodTagged {
  voicing: 'mono' | 'dyad' | 'triad' | 'octave'
  contour?: number[]                         // authored degree sequence (looped/truncated to the onset count)
  gen?: (rng: Rng, n: number) => number[]    // generative strategy — emits exactly n degrees
}

const DYAD_3RD = 2          // +2 scale degrees ≈ a (diatonic) third
const TRIAD = [0, 2, 4]     // root, third, fifth in degree space
const OCTAVE_DEG = 7        // one octave down in a heptatonic scale ≈ -7 degrees

const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']

// — generative strategies —
const WALK_STEP = [-2, -1, -1, -1, 1, 2, 0] // small steps, biased downward (dark resolves down — no uplift)
const WALK_SPREAD = 7
function walkDown(rng: Rng, n: number): number[] {
  let d = rng.int(3)
  const out: number[] = []
  for (let i = 0; i < n; i++) { d = Math.max(-WALK_SPREAD, Math.min(WALK_SPREAD, d + WALK_STEP[rng.int(WALK_STEP.length)])); out.push(d) }
  return out
}
const ARP_SHAPE = [0, 2, 4, 7, 4, 2] // up-and-back over chord tones (degree space)
function arpChord(_rng: Rng, n: number): number[] { return Array.from({ length: n }, (_, i) => ARP_SHAPE[i % ARP_SHAPE.length]) }
const PEDAL_NEIGHBOURS = [0, 1, 0, -1, 0, 2, 0, -2] // tonic pedal pricked by neighbours
function pedalNeighbour(_rng: Rng, n: number): number[] { return Array.from({ length: n }, (_, i) => PEDAL_NEIGHBOURS[i % PEDAL_NEIGHBOURS.length]) }
const CADENCE_STARTS = [7, 5, 4, 8]
const CADENCE_FLOOR = -5
/** A short descending cadence (used by note 3's exit-fill too): starts high, falls home. */
export function descCadence(rng: Rng, n: number): number[] {
  let d = CADENCE_STARTS[rng.int(CADENCE_STARTS.length)]
  const out: number[] = []
  for (let i = 0; i < n; i++) { out.push(d); d = i % 2 === 0 ? d - 2 : d - 1; if (d < CADENCE_FLOOR) d = 0 }
  return out
}

const SUB_STARTS = [48, 50, 47, 45]
const SUB_STEPS = [6, 5, 6, 7, 4]
const SUB_MIN_LEN = 4
const SUB_LEN_VAR = 3
/** A seeded descending sub run (note 3's subDrop) — starts mid-low, falls in varied steps. Absolute MIDI. */
export function descSubRun(rng: Rng): number[] {
  let m = SUB_STARTS[rng.int(SUB_STARTS.length)]
  const len = SUB_MIN_LEN + rng.int(SUB_LEN_VAR) // 4..6 notes
  const out: number[] = []
  for (let i = 0; i < len; i++) { out.push(m); m -= SUB_STEPS[rng.int(SUB_STEPS.length)] }
  return out
}

export const LEAD_MELODIES: LeadMelody[] = [
  // authored contours (degrees only — rhythm comes from the rhythm axis)
  { id: 'callResp', voicing: 'mono', contour: [0, 3, 2, 0, 5, 7, 5, 3] },
  { id: 'bellLine', voicing: 'mono', contour: [0, 3, 2, 5, 3, 2, 0, -2] },
  { id: 'octJump', voicing: 'octave', contour: [0, 7, 0, 4, 0, 7, 4, 0] },
  { id: 'glassArp', voicing: 'mono', contour: [0, 7, 3, 7, 5, 7, 0, 9, 3, 7, 5, 9, 7, 5, 3, 0] },
  { id: 'fog', voicing: 'mono', contour: [4, 3, 2, 3, 0, -2, 0], moods: CALM },
  { id: 'chime', voicing: 'mono', contour: [0, 4, 7, 4, 5, 2, 7, 9, 7, 4, 2, 0] },
  { id: 'doubleStop', voicing: 'dyad', contour: [0, 3, 2, 5, 0, -2] },
  { id: 'chordStab', voicing: 'triad', contour: [0, 2, -2, 4, 0, 3] },
  // generative strategies
  { id: 'walk', voicing: 'mono', gen: walkDown },
  { id: 'arp', voicing: 'mono', gen: arpChord },
  { id: 'pedal', voicing: 'mono', gen: pedalNeighbour },
  { id: 'cadence', voicing: 'mono', gen: descCadence, moods: [...CALM, 'dark_techno'] },
]

function applyVoicing(d: number, v: LeadMelody['voicing']): MelEl {
  if (v === 'mono') return d
  if (v === 'octave') return [d - OCTAVE_DEG, d]  // pair with a voice ~an octave below (combiner maps via deg)
  if (v === 'dyad') return [d, d + DYAD_3RD]
  return TRIAD.map((t) => d + t)                  // triad
}
/** Emit exactly n voiced elements: from a looped contour or a generative strategy. */
export function emitMelody(m: LeadMelody, rng: Rng, n: number): MelEl[] {
  const base = m.gen ? m.gen(rng, n) : Array.from({ length: n }, (_, i) => m.contour![i % m.contour!.length])
  return base.map((d) => applyVoicing(d, m.voicing))
}
