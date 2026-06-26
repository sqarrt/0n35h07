import type { Rng } from '../../seededRandom'
import type { Chord } from '../theory'
import { AntiRepeatBuffer } from '../AntiRepeatBuffer'
import { weightedPick, type Weighted } from '../weighted'

export interface LeadMotif { mask: number[]; notes: number[] }
export interface LeadState { motif: LeadMotif | null; phrasesLeft: number }

const STEPS = 16
// The motif holds for a whole movement (FX/arrangement provide the variety, not new
// notes); the composer resets it at movement boundaries (break / new track).
const REPHRASE = 999

// RHYTHM FEELS — the lead used to be ONE busy 16th pattern, which read as cheesy "disco" and
// made every track's lead sound the same. Now it picks (anti-repeat → differs track-to-track)
// from several DISTINCT feels, MOST of them sparse / stabby / off-beat (dark-techno restraint);
// the busy "driving" 16ths are kept but rare. Fewer notes = more hypnotic, less melodic-pop.
const FEELS: Record<string, string> = {
  stab:    'x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~',   // two long stabs per bar
  stabOff: '~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~',   // stabs pushed onto the off-beats
  pulse8:  'x ~ x ~ x ~ x ~ x ~ x ~ x ~ x ~',    // steady 8ths (mid density)
  offbeat: '~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ x ~',    // syncopated off-beat pulse
  sparse:  'x ~ ~ ~ x ~ ~ x ~ ~ x ~ ~ ~ x ~',    // loose, holey
  clave:   'x ~ ~ x ~ ~ x ~ ~ ~ x ~ x ~ ~ ~',    // clave-ish push
  driving: 'x ~ x x x ~ x x x ~ x x x ~ x x',     // the busy 16ths — RARE now
}
// Weighting via repetition in the pick list: stab/sparse common, driving uncommon.
const FEEL_KEYS = ['stab', 'stab', 'stabOff', 'pulse8', 'offbeat', 'sparse', 'sparse', 'clave', 'driving']

type Contour = 'pedal' | 'twonote' | 'descend' | 'zigzag'
// Hypnotic pedal / two-note minimalism favoured over the wandering zigzag (which sounded melodic-pop).
const CONTOURS: Contour[] = ['pedal', 'pedal', 'twonote', 'twonote', 'descend', 'zigzag']

const DEFAULT_SCALE = [0, 2, 3, 5, 7, 8, 10] // aeolian fallback

export function initialLeadState(): LeadState { return { motif: null, phrasesLeft: 0 } }

export interface LeadOpts { rng: Rng; leadOctave: number; density: number; scale?: number[]; keyRoot?: number; anti?: AntiRepeatBuffer }

export class MelodyEngine {
  buildLead(chord: Chord, opts: LeadOpts, state: LeadState): { fragment: string; state: LeadState } {
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

  /** A feel (rhythm) + a contour (note cell) chosen with anti-repeat → leads differ track-to-track.
   *  The cell wavers within the SAFE (minor-pentatonic) degrees, anchored to the tonic — never a
   *  bright ascending run ("tropical") and never the b2/tritone clash. */
  private makeMotif(chord: Chord, opts: LeadOpts): LeadMotif {
    const { rng } = opts
    const scale = opts.scale ?? DEFAULT_SCALE
    const keyRoot = opts.keyRoot ?? chord.notes[0]
    const feelKey = opts.anti ? pickAnti(FEEL_KEYS, rng, opts.anti, 'lead_feel') : FEEL_KEYS[rng.int(FEEL_KEYS.length)]
    const contour = opts.anti ? pickAnti(CONTOURS, rng, opts.anti, 'lead_contour') : CONTOURS[rng.int(CONTOURS.length)]
    const mask = FEELS[feelKey].split(' ').map((t) => (t === 'x' ? 1 : 0))

    // pool = the SAFE (minor-pentatonic) degrees of the scale, across ~1 octave, sorted.
    const base = keyRoot + 12 * (opts.leadOctave - 3)
    const SAFE = new Set([0, 3, 5, 7, 10])
    let safeIvs = scale.filter((iv) => SAFE.has(((iv % 12) + 12) % 12))
    if (safeIvs.length < 3) safeIvs = scale
    const pool: number[] = safeIvs.map((iv) => base + iv)
    pool.push(base + 12)
    pool.sort((a, b) => a - b)

    // anchor = the pool tone closest in pitch-class to the key root (the note the bass holds).
    let anchor = 0
    let bestD = Infinity
    pool.forEach((nn, i) => {
      const d = Math.min(((nn - base) % 12 + 12) % 12, ((base - nn) % 12 + 12) % 12)
      if (d < bestD) { bestD = d; anchor = i }
    })
    const lo = Math.max(0, anchor - 2)
    const hi = Math.min(pool.length - 1, anchor + 2)
    return { mask, notes: this.buildCell(contour, pool, anchor, lo, hi, rng) }
  }

  /** The note cell, shaped by the chosen contour. All start grounded on the tonic. */
  private buildCell(contour: Contour, pool: number[], anchor: number, lo: number, hi: number, rng: Rng): number[] {
    const tonic = pool[anchor]
    if (contour === 'pedal') {
      // mostly the tonic with one neighbour — the hypnotic 303 pedal
      const nb = pool[Math.min(hi, anchor + 1)]
      const lo2 = pool[Math.max(lo, anchor - 2)]
      return rng.next() < 0.5 ? [tonic, tonic, nb, tonic] : [tonic, lo2, tonic, tonic]
    }
    if (contour === 'twonote') {
      // minimal two-tone oscillation (techno restraint)
      const other = pool[rng.next() < 0.5 ? Math.max(lo, anchor - 2) : Math.min(hi, anchor + 2)]
      return [tonic, other]
    }
    if (contour === 'descend') {
      // a short falling phrase that lands home — never an ascending uplift
      const cell: number[] = []
      let cur = Math.min(hi, anchor + 2)
      const len = 4 + rng.int(2)
      for (let k = 0; k < len; k++) { cell.push(pool[cur]); cur = Math.max(lo, cur - 1) }
      return cell
    }
    // zigzag — a walking cell that snaps home ~22% (the old behaviour, now just one option)
    const cellLen = 4 + rng.int(3)
    const cell: number[] = []
    let cur = anchor
    for (let k = 0; k < cellLen; k++) {
      cell.push(pool[cur])
      if (k > 0 && rng.next() < 0.22) cur = anchor
      else { const dir = cur <= lo ? 1 : cur >= hi ? -1 : (rng.next() < 0.5 ? 1 : -1); cur += dir }
    }
    return cell
  }
}

function pickAnti<T>(arr: readonly T[], rng: Rng, anti: AntiRepeatBuffer, cat: string): T {
  const opts = arr.map((_, i) => [String(i), 1] as Weighted<string>)
  const idx = Number(weightedPick(rng, anti.penalize(cat, opts)))
  anti.record(cat, String(idx))
  return arr[idx]
}
