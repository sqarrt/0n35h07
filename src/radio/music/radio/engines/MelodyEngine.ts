import type { Rng } from '../../seededRandom'
import type { Chord } from '../theory'

export interface LeadMotif { mask: number[]; notes: number[] }
export interface LeadState { motif: LeadMotif | null; phrasesLeft: number }

const STEPS = 16
// The motif holds for a whole movement (FX/arrangement provide the variety, not new
// notes); the composer resets it at movement boundaries (break / new track).
const REPHRASE = 999

// DRIVING 16th acid riffs — mostly continuous, strong-beat-anchored, spread across the
// whole bar. The hypnotic feel comes from a TIGHT, repeating note cell (below).
const MASKS = [
  'x ~ x x x ~ x x x ~ x x x ~ x x',
  'x x ~ x x x ~ x x ~ x x x x ~ x',
  'x ~ x x x x ~ x x x ~ x x ~ x x',
  'x x x ~ x x x ~ x x ~ x x x x ~',
  'x ~ x ~ x x x ~ x ~ x x x ~ x x',
  'x ~ ~ x x ~ x x ~ x x ~ x x ~ x', // a touch sparser
]

const DEFAULT_SCALE = [0, 2, 3, 5, 7, 8, 10] // aeolian fallback

export function initialLeadState(): LeadState { return { motif: null, phrasesLeft: 0 } }

export class MelodyEngine {
  buildLead(
    chord: Chord,
    opts: { rng: Rng; leadOctave: number; density: number; scale?: number[]; keyRoot?: number },
    state: LeadState,
  ): { fragment: string; state: LeadState } {
    let motif = state.motif
    let phrasesLeft = state.phrasesLeft
    if (!motif || phrasesLeft <= 0) {
      motif = this.makeMotif(chord, opts)
      phrasesLeft = REPHRASE
    }
    phrasesLeft--

    let onset = 0
    const steps: string[] = []
    for (let i = 0; i < STEPS; i++) {
      if (motif.mask[i]) { steps.push(String(motif.notes[onset % motif.notes.length])); onset++ } // CYCLE the cell = riff
      else steps.push('~')
    }
    return { fragment: `note("${steps.join(' ')}")`, state: { motif, phrasesLeft } }
  }

  /** A driving rhythm + a TIGHT cell that wavers (zig-zags) around a chord tone within
   *  ±2 scale steps — a hypnotic riff, never a bright ascending run ("tropical"). */
  private makeMotif(
    chord: Chord,
    opts: { rng: Rng; leadOctave: number; density: number; scale?: number[]; keyRoot?: number },
  ): LeadMotif {
    const { rng } = opts
    const scale = opts.scale ?? DEFAULT_SCALE
    const keyRoot = opts.keyRoot ?? chord.notes[0]
    const mask = (rng.next() < opts.density ? pickFrom(MASKS.slice(0, 5), rng) : pickFrom(MASKS, rng))
      .split(' ').map((t) => (t === 'x' ? 1 : 0))

    // pool = the SAFE (minor-pentatonic) degrees of the scale, across ~1 octave, sorted.
    // The minor-pentatonic core [0,3,5,7,10] has NO semitone adjacencies, so the riff can
    // never trill on the b2/tritone (the "weird/off" clash) — still dark/minor.
    const base = keyRoot + 12 * (opts.leadOctave - 3)
    const SAFE = new Set([0, 3, 5, 7, 10])
    let safeIvs = scale.filter((iv) => SAFE.has(((iv % 12) + 12) % 12))
    if (safeIvs.length < 3) safeIvs = scale // pathological scale: fall back to all tones
    const pool: number[] = safeIvs.map((iv) => base + iv)
    pool.push(base + 12)
    pool.sort((a, b) => a - b)

    // ANCHORED PEDAL RIFF — the lead must FIT the bass, so it pivots on the TONIC and keeps
    // returning to it (hypnotic 303 style), instead of free-wandering off into its own key.
    // anchor = the pool tone closest in pitch-class to the key root (the note the bass holds).
    let anchor = 0
    let bestD = Infinity
    pool.forEach((nn, i) => {
      const d = Math.min(((nn - base) % 12 + 12) % 12, ((base - nn) % 12 + 12) % 12)
      if (d < bestD) { bestD = d; anchor = i }
    })
    // A real RIFF with a contour (not a 2-note bounce, not free-wander): a 4..6 note cell
    // that WALKS the pentatonic within ±2 of the anchor (≈ a 5th span), mostly stepping, and
    // snaps home to the tonic ~30% of the time for the hypnotic pull. 3-4 distinct tones.
    const lo = Math.max(0, anchor - 2)
    const hi = Math.min(pool.length - 1, anchor + 2)
    const cellLen = 4 + rng.int(3) // 4..6 notes — a phrase, not two notes ping-ponging
    const cell: number[] = []
    let cur = anchor // START on the tonic → grounded to the bass
    for (let k = 0; k < cellLen; k++) {
      cell.push(pool[cur])
      if (k > 0 && rng.next() < 0.22) cur = anchor // pull home (pedal), but not on the 1st move
      else {
        const dir = cur <= lo ? 1 : cur >= hi ? -1 : (rng.next() < 0.5 ? 1 : -1) // step, bounce off the edges
        cur += dir
      }
    }
    return { mask, notes: cell }
  }
}

function pickFrom<T>(arr: readonly T[], rng: Rng): T { return arr[rng.int(arr.length)] }
