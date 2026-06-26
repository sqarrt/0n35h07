import type { Rng } from '../../seededRandom'
import type { Chord } from '../theory'
import { AntiRepeatBuffer } from '../AntiRepeatBuffer'
import { weightedPick, type Weighted } from '../weighted'

// A lead is (harmonic CONTENT) × (a rhythm DEVICE) — see docs/radio-leads-lessons.md (Switch Angel study).
// We have raw Strudel (no notearp/trancegate/struct/acidenv helpers), so we EMULATE the devices directly in
// the note pattern: 16-step driving cells (acid), arpeggiated dyads, and a per-bar GATE baked into the notes
// (trance-gate). Content is written as SCALE DEGREES — tonic-anchored, mostly descending/returning, in-key.

// motif holds the finished pattern string (inside note("…")), stable for a whole movement. `atmo` flags the
// soulful "ballad" archetype so the composer applies its echo+bloom chain (not the acid squelch).
export interface LeadMotif { pattern: string; atmo?: boolean }
export interface LeadState { motif: LeadMotif | null; phrasesLeft: number }
const REPHRASE = 999

export function initialLeadState(): LeadState { return { motif: null, phrasesLeft: 0 } }

export interface LeadOpts { rng: Rng; leadOctave: number; density: number; scale?: number[]; keyRoot?: number; anti?: AntiRepeatBuffer }

const DEFAULT_SCALE = [0, 2, 3, 5, 7, 8, 10] // aeolian fallback

// ── Curated scale-degree figures (the "good melody pool"). Degrees are SCALE STEPS (0 = root, 7 = octave,
//    9 = octave+3rd, …); negative = below the tonic. All ANCHORED on the tonic (0), mostly descending/returning.
const ACID_CELLS = [
  [0, 4, 0, 9, 7],              // the canonical 0 4 0 9 7
  [0, 0, 7, 0, 10, 0, 5, 0],
  [0, 3, 0, 7, 0, 12, 0, 7],
  [0, 7, 0, 5, 0, 3, 0, 0],
  [0, 0, 12, 7, 0, 5, 0, 3],
  [0, -3, 0, 4, 0, 7, 0, 3],
]
const DYAD_HIGHS = [
  [6, 7, 4, 8], [7, 5, 8, 4], [4, 6, 7, 5], [9, 7, 6, 8], [7, 4, 9, 7],
]
// Sparse anchored 8-step cells (rests = ~) for the pool-motif archetype — tight, hypnotic, return to 0.
const MOTIF_CELLS = [
  ['0', '~', '3', '0', '~', '0', '-2', '0'],
  ['0', '~', '~', '7', '~', '5', '~', '0'],
  ['0', '0', '~', '3', '~', '~', '-3', '0'],
  ['0', '~', '5', '~', '4', '~', '0', '~'],
  ['0', '~', '-2', '0', '~', '3', '~', '0'],
]
// Sparse dyad "ballad" leads (atmoDyad) — held dyads [descending PEDAL, upper voice] with lots of SPACE; the
// soulful FX (heavy echo + slow filter bloom) are applied by the caller. Each row = 8 bars, 1 element/bar, null
// = a rest. The pedal (1st value) descends/returns (0 → -2/-3 → 0); the upper voice (2nd) is a 3rd/5th above.
const ATMO_DYADS: (number[] | null)[][] = [
  [[0, 4], null, null, [0, 2], null, [-3, 2], null, null],
  [[0, 4], null, [-2, 2], null, null, [0, 4], null, null],
  [[0, 2], null, null, [-3, 4], null, null, [0, 2], null],
  [[-3, 2], null, [0, 4], null, null, [-5, 4], null, null],
  [[0, 4], null, null, [-3, 2], null, [0, 4], null, [-2, 2]],
]
// Trance-gate rhythm masks (16 steps; x = open, ~ = closed) for the gated-phrase archetype.
const GATE_MASKS = [
  ['x', '~', 'x', 'x', '~', 'x', '~', 'x', 'x', '~', 'x', 'x', '~', 'x', '~', 'x'],
  ['x', 'x', '~', 'x', '~', 'x', 'x', '~', 'x', 'x', '~', 'x', '~', 'x', 'x', '~'],
  ['x', '~', '~', 'x', 'x', '~', 'x', '~', 'x', '~', '~', 'x', 'x', '~', 'x', '~'],
  ['x', 'x', 'x', '~', 'x', 'x', '~', 'x', 'x', 'x', '~', 'x', 'x', '~', 'x', '~'],
]

type Archetype = 'acidCell' | 'arpDyad' | 'gatedPhrase' | 'poolMotif' | 'atmoDyad'
// All five archetypes are EQUALLY likely (~20% each); anti-repeat picks a DIFFERENT one than the prev track.
const ARCHETYPES: Archetype[] = ['acidCell', 'arpDyad', 'gatedPhrase', 'poolMotif', 'atmoDyad']

export class MelodyEngine {
  buildLead(_chord: Chord, opts: LeadOpts, state: LeadState): { fragment: string; atmo: boolean; state: LeadState } {
    let motif = state.motif
    let phrasesLeft = state.phrasesLeft
    if (!motif || phrasesLeft <= 0) {
      motif = this.makeMotif(opts)
      phrasesLeft = REPHRASE
    }
    phrasesLeft--
    return { fragment: `note("${motif.pattern}")`, atmo: !!motif.atmo, state: { motif, phrasesLeft } }
  }

  /** A SPARSE dyad "ballad" lead (the soulful break lead): 8 BAR-ELEMENTS of held dyads [descending pedal,
   *  upper voice] with lots of space. Returns the per-bar elements (the CALLER wraps them with its
   *  section-alignment + adds the heavy echo + slow filter bloom that make it weep). */
  atmoDyad(opts: { leadOctave: number; scale?: number[]; keyRoot?: number }, rng: Rng): string[] {
    const scale = opts.scale ?? DEFAULT_SCALE
    const base = (opts.keyRoot ?? 0) + 12 * (opts.leadOctave - 3)
    const deg = (d: number): number => base + 12 * Math.floor(d / scale.length) + scale[((d % scale.length) + scale.length) % scale.length]
    const pat = ATMO_DYADS[rng.int(ATMO_DYADS.length)]
    return pat.map((el) => (el ? `[${deg(el[0])},${deg(el[1])}]` : '~'))
  }

  /** Build one movement's lead pattern: pick an archetype (anti-repeat) and render it as a note string. */
  private makeMotif(opts: LeadOpts): LeadMotif {
    const { rng } = opts
    const scale = opts.scale ?? DEFAULT_SCALE
    const base = (opts.keyRoot ?? 0) + 12 * (opts.leadOctave - 3)
    // scale-step → midi (wraps octaves; negative steps go below the tonic, staying in-scale)
    const deg = (d: number): number => {
      const L = scale.length
      return base + 12 * Math.floor(d / L) + scale[((d % L) + L) % L]
    }
    const arch = opts.anti ? (pickAnti(ARCHETYPES, rng, opts.anti, 'lead_arch')) : ARCHETYPES[rng.int(ARCHETYPES.length)]

    if (arch === 'atmoDyad') {
      // the soulful "ballad": sparse held dyads (the composer applies the echo + slow-bloom chain via `atmo`)
      const els = this.atmoDyad({ leadOctave: opts.leadOctave + 1, scale: opts.scale, keyRoot: opts.keyRoot }, rng)
      return { pattern: `<${els.join(' ')}>`, atmo: true }
    }
    if (arch === 'acidCell') {
      // a driving 16th cell (0 4 0 9 7 family), root-anchored — the expression comes from the filter env.
      const cell = ACID_CELLS[rng.int(ACID_CELLS.length)]
      return { pattern: Array.from({ length: 16 }, (_, i) => String(deg(cell[i % cell.length]))).join(' ') }
    }
    if (arch === 'arpDyad') {
      // dyads [tonic-pedal, moving scale tone] arpeggiated into 16ths: lo hi lo hi per beat.
      const highs = DYAD_HIGHS[rng.int(DYAD_HIGHS.length)]
      const lo = deg(0)
      const steps: string[] = []
      for (let b = 0; b < 4; b++) { const hi = deg(highs[b]); steps.push(String(lo), String(hi), String(lo), String(hi)) }
      return { pattern: steps.join(' ') }
    }
    if (arch === 'gatedPhrase') {
      // a few held notes (one per bar) chopped by a 16-step gate baked per bar → a trance-gated lead.
      const phrase = [0, rng.next() < 0.5 ? -3 : 2, rng.next() < 0.5 ? 0 : -5, 0]
      const notes = phrase.map(deg)
      if (rng.next() < 0.4) notes[1] += 1 // an occasional chromatic colour (#)
      const mask = GATE_MASKS[rng.int(GATE_MASKS.length)]
      const bars = notes.map((m) => `[${mask.map((g) => (g === 'x' ? String(m) : '~')).join(' ')}]`)
      return { pattern: `<${bars.join(' ')}>` }
    }
    // poolMotif — a sparse, anchored 8-step cell with one chromatic colour note.
    const cell = MOTIF_CELLS[rng.int(MOTIF_CELLS.length)]
    const colourAt = rng.int(cell.length)
    const steps = cell.map((t, i) => {
      if (t === '~') return '~'
      const m = deg(Number(t)) + (i === colourAt && rng.next() < 0.5 ? 1 : 0) // chromatic twist
      return String(m)
    })
    return { pattern: steps.join(' ') }
  }
}

function pickAnti<T>(arr: readonly T[], rng: Rng, anti: AntiRepeatBuffer, cat: string): T {
  const opts = arr.map((_, i) => [String(i), 1] as Weighted<string>)
  const idx = Number(weightedPick(rng, anti.penalize(cat, opts)))
  anti.record(cat, String(idx))
  return arr[idx]
}
