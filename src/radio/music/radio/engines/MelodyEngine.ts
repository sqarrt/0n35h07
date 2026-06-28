import type { Rng } from '../../seededRandom'
import type { Chord } from '../theory'
import { AntiRepeatBuffer } from '../AntiRepeatBuffer'
import { weightedPick, type Weighted } from '../weighted'

// A lead is (harmonic CONTENT) × (a rhythm/timbre DEVICE) — see docs/radio-leads-lessons.md +
// docs/radio-lead-archetypes.md (the co-designed archetype set). The ENGINE only produces the note CONTENT
// (absolute MIDI, no Strudel .scale()) + a `voice` tag; the COMPOSER renders the per-voice synth/FX chain.

// `voice` selects the composer's synth+FX chain. Patterns are ABSOLUTE MIDI so no .scale() is needed downstream.
export type LeadVoiceId =
  | 'arpDyad' | 'atmoDyad' | 'chordStab' | 'lament' | 'callResponse' | 'octavePulse'
  | 'bellMelody' | 'stutterStab' | 'leadingTone' | 'phrygianHalf' | 'doubleStop'
  | 'glitchStorm' | 'tritone' | 'glassArp' | 'ghostVoice' | 'detunedDrift' | 'warpedBox' | 'crushBell'
  | 'fogMelody' | 'digitalChime' | 'rustString' | 'digitalRain' // co-designed CALM/atmospheric (Silent Hill + virtual)

export interface LeadMotif { pattern: string; voice: LeadVoiceId }
export interface LeadState { motif: LeadMotif | null; phrasesLeft: number }
const REPHRASE = 999

export function initialLeadState(): LeadState { return { motif: null, phrasesLeft: 0 } }

export interface LeadOpts { rng: Rng; leadOctave: number; density: number; scale?: number[]; keyRoot?: number; anti?: AntiRepeatBuffer }

const DEFAULT_SCALE = [0, 2, 3, 5, 7, 8, 10] // aeolian fallback
// Modal colours imposed REGARDLESS of the track scale (these archetypes ARE their harmony):
const HARM_MINOR = [0, 2, 3, 5, 7, 8, 11]    // leadingTone — the raised 7th pulls UP to the tonic
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10]      // phrygianHalf — the b2 presses DOWN

// Moving upper voices for the arpDyad (tonic-pedal + a moving scale tone, arpeggiated lo/hi).
const DYAD_HIGHS = [
  [6, 7, 4, 8], [7, 5, 8, 4], [4, 6, 7, 5], [9, 7, 6, 8], [7, 4, 9, 7],
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

// A pattern ELEMENT: a rest, a single scale-step, or a stacked chord/dyad of scale-steps.
type El = '~' | number | number[]
// All 18 archetypes are EQUALLY likely; anti-repeat picks a DIFFERENT one than the previous track.
const ARCHETYPES: LeadVoiceId[] = [
  'atmoDyad', 'chordStab', 'callResponse', 'octavePulse', 'bellMelody', 'stutterStab',
  'doubleStop', 'glitchStorm', 'glassArp', 'ghostVoice',
  'detunedDrift', 'warpedBox', 'crushBell',
  'fogMelody', 'digitalChime', 'rustString', 'digitalRain', // co-designed calm/atmospheric (SH + virtual)
]
// DROPPED from the pool (in the live mix they read wrong; voice/pattern code stays but is unreachable):
//  • leadingTone — harmonic-minor raised-7th, ascending 0→5→6→7 drama → too melodic/uplifting for the dark vibe.
//  • tritone — the b5 "diabolus" LEAD (great as a BASS, kept there) → too dissonant/ugly as a lead in the mix.
//  • arpDyad — the old busy 16th tonic-pedal-arp (predates the dark co-design) → reads as disco/busy, the type
//    the user consistently rejects (acidCell/mono303 family).
//  • lament — the descending melancholic phrase. Dropped from BOTH pools below — it was in ARCHETYPES *and*
//    RESTFUL_LEADS, so it surfaced far more often than the rest, and the user didn't want it.
//  • phrygianHalf — busy phrygian melody pivoting on the b2 (minor 2nd). Busy AND dissonant → exactly the type
//    the user keeps rejecting in the live mix.
// The break's job is to REST the ears → only the atmospheric/restful archetypes (no driving acid/stab/glitch).
// The composer renders one of these through the break's low-gain, echo-drowned chain (a different lead than the
// track's main one, by design).
const RESTFUL_LEADS: LeadVoiceId[] = [
  'atmoDyad', 'callResponse', 'bellMelody', 'ghostVoice', 'glassArp', 'detunedDrift', 'warpedBox',
  'doubleStop', 'crushBell',
  'fogMelody', 'digitalChime', 'rustString', 'digitalRain', // the calm co-designs — perfect for the break's rest
]

// 4-bar phrases (each bar = an El[]) and 16-step single lines (an El[]), as scale-DEGREE figures. The builder
// maps degrees → absolute MIDI via the active `deg`. Chromatic archetypes pass their own modal `deg`.
const PHRASES: Partial<Record<LeadVoiceId, El[][]>> = {
  lament: [[6, '~', 4, '~', 3, '~', 2, '~'], ['~', 2, '~', 0, '~', -2, '~', '~'], [4, '~', '~', 3, 2, '~', 0, '~'], ['~', 0, '~', -3, '~', 0, '~', '~']],
  callResponse: [[0, '~', 3, '~', 2, '~', 0, '~'], ['~', 0, '~', '~', '~', '~', '~', '~'], [5, '~', 7, '~', 5, '~', 3, '~'], ['~', 3, '~', 2, '~', 0, '~', '~']],
  bellMelody: [[0, '~', '~', 3, '~', 2, '~', '~'], ['~', '~', 5, '~', 3, '~', 2, '~'], ['~', 0, '~', -2, '~', '~', 0, '~'], [3, '~', 2, '~', 0, '~', '~', '~']],
  stutterStab: [[0, '~', 0, '~', 3, '~', 0, '~'], [0, '~', 3, '~', 2, '~', 0, '~'], [5, '~', 3, '~', 0, '~', 2, '~'], [3, '~', 0, '~', -2, '~', 0, '~']],
  leadingTone: [[0, '~', 5, '~', 6, '~', 7, '~'], ['~', 5, '~', 3, '~', 2, '~', 0], [3, '~', 6, '~', 7, '~', 6, '~'], ['~', 5, '~', 2, '~', 0, '~', '~']],
  phrygianHalf: [[0, '~', 1, '~', 0, '~', -2, '~'], ['~', -1, '~', -2, '~', 0, '~', 1], [2, '~', 1, '~', 0, '~', 1, '~'], ['~', 0, '~', -2, '~', 0, '~', '~']],
  doubleStop: [[[0, 4], '~', [3, 7], '~', '~', '~', '~', '~'], [[2, 6], '~', [0, 4], '~', '~', '~', '~', '~'], [[5, 9], '~', [3, 7], '~', '~', '~', '~', '~'], [[0, 4], '~', '~', '~', '~', '~', '~', '~']],
  tritone: [[0, '~', 4, '~', 3, '~', 2, '~'], ['~', '~', '~', '~', '~', '~', '~', '~'], [0, '~', 3, '~', '~', '~', 0, '~'], ['~', '~', '~', -2, '~', 0, '~', '~']],
  ghostVoice: [[0, '~', '~', 3, '~', 2, '~', '~'], ['~', 0, '~', '~', -2, '~', 0, '~'], [3, '~', 2, '~', 0, '~', -3, '~'], ['~', 0, '~', '~', '~', '~', '~', '~']],
  detunedDrift: [[0, '~', '~', -2, '~', '~', '~', '~'], [3, '~', '~', 0, '~', '~', '~', '~'], [-2, '~', '~', 0, '~', '~', '~', '~'], [0, '~', '~', '~', '~', '~', '~', '~']],
  warpedBox: [[0, '~', 3, '~', 5, '~', 3, '~'], [2, '~', 0, '~', -2, '~', 0, '~'], [3, '~', 5, '~', 7, '~', 5, '~'], [3, '~', 2, '~', 0, '~', '~', '~']],
  crushBell: [[0, '~', 3, '~', 0, '~', 5, '~'], [3, '~', 2, '~', 0, '~', -2, '~'], [5, '~', 3, '~', 7, '~', 5, '~'], [3, '~', 0, '~', 2, '~', 0, '~']],
  // co-designed CALM/atmospheric leads — sparse, lots of space (a whole rest-bar to breathe). SH + virtual.
  fogMelody: [[4, '~', '~', '~', 3, '~', '~', '~'], [2, '~', '~', '~', '~', '~', '~', '~'], [3, '~', '~', 2, '~', '~', 0, '~'], ['~', '~', '~', '~', '~', '~', '~', '~']],
  digitalChime: [[0, '~', 4, '~', 7, '~', 4, '~'], ['~', '~', 5, '~', '~', '~', 2, '~'], [7, '~', 9, '~', 7, '~', 4, '~'], ['~', 2, '~', '~', 0, '~', '~', '~']],
  rustString: [[0, '~', '~', 2, '~', '~', '~', '~'], [3, '~', '~', 2, '~', 0, '~', '~'], ['~', '~', 0, '~', '~', -2, '~', '~'], [0, '~', '~', '~', '~', '~', '~', '~']],
  digitalRain: [[0, '~', 2, '~', 4, '~', 2, '~'], [4, '~', 6, '~', 4, '~', 2, '~'], ['~', 2, '~', 4, '~', 2, '~', 0], ['~', '~', 0, '~', '~', '~', '~', '~']],
}
const LINES: Partial<Record<LeadVoiceId, El[]>> = {
  octavePulse: [0, '~', '~', 7, '~', 0, '~', '~', 0, '~', 7, '~', '~', 4, '~', 0],
  glitchStorm: [0, 3, 7, 0, 2, 5, 0, 3, 0, 7, 2, 0, 5, 0, 3, 2],
  glassArp: [0, 7, 3, 7, 5, 7, 0, 9, 3, 7, 5, 9, 7, 5, 3, 0],
}
// tritone needs the b5 (a chromatic note absent from any heptatonic mode) — its degrees are raw SEMITONE offsets
// from the tonic, not scale steps. {0,1,3,5,6,7} → root, b2, b3, 4, b5(diabolus), 5.
const TRITONE_SEMI = [0, 2, 3, 4, 6, 7] // index → semitones (deg 4 = 6 = the b5)

export class MelodyEngine {
  buildLead(_chord: Chord, opts: LeadOpts, state: LeadState): { fragment: string; voice: LeadVoiceId; state: LeadState } {
    let motif = state.motif
    let phrasesLeft = state.phrasesLeft
    if (!motif || phrasesLeft <= 0) {
      motif = this.makeMotif(opts)
      phrasesLeft = REPHRASE
    }
    phrasesLeft--
    return { fragment: `note("${motif.pattern}")`, voice: motif.voice, state: { motif, phrasesLeft } }
  }

  /** A SPARSE dyad "ballad" lead (the soulful break lead): 8 BAR-ELEMENTS of held dyads [descending pedal,
   *  upper voice] with lots of space. Returns the per-bar elements (the CALLER wraps them with its
   *  section-alignment + adds the heavy echo + slow filter bloom that make it weep). */
  atmoDyad(opts: { leadOctave: number; scale?: number[]; keyRoot?: number }, rng: Rng): string[] {
    const scale = opts.scale ?? DEFAULT_SCALE
    const base = (opts.keyRoot ?? 0) + 12 * (opts.leadOctave - 3)
    const deg = degFn(scale, base)
    const pat = ATMO_DYADS[rng.int(ATMO_DYADS.length)]
    return pat.map((el) => (el ? `[${deg(el[0])},${deg(el[1])}]` : '~'))
  }

  /** Build one movement's lead: pick an archetype (anti-repeat) and render its note content. */
  private makeMotif(opts: LeadOpts): LeadMotif {
    const voice = opts.anti ? pickAnti(ARCHETYPES, opts.rng, opts.anti, 'lead_arch') : ARCHETYPES[opts.rng.int(ARCHETYPES.length)]
    return { pattern: this.patternFor(voice, opts), voice }
  }

  /** Pick a RESTFUL archetype for a BREAK (different from the track's main lead `avoid`) and render its pattern.
   *  The caller renders it through the break's low-gain, echo-drowned chain — so the break rests the ears with a
   *  DIFFERENT lead (its own timbre) each time, drawn from the same 18-voice set as the main lead. */
  buildBreakLead(opts: LeadOpts, avoid?: LeadVoiceId): { pattern: string; voice: LeadVoiceId } {
    const pool = RESTFUL_LEADS.filter((v) => v !== avoid)
    const voice = pool[opts.rng.int(pool.length)]
    return { pattern: this.patternFor(voice, opts), voice }
  }

  /** Render a given archetype's note CONTENT (absolute MIDI) for the track's key/scale. */
  private patternFor(voice: LeadVoiceId, opts: LeadOpts): string {
    const { rng } = opts
    const scale = opts.scale ?? DEFAULT_SCALE
    const base = (opts.keyRoot ?? 0) + 12 * (opts.leadOctave - 3)
    const deg = degFn(scale, base)
    // atmoDyad — the soulful ballad (sparse held dyads, 8 bars).
    if (voice === 'atmoDyad') {
      return `<${this.atmoDyad({ leadOctave: opts.leadOctave + 1, scale: opts.scale, keyRoot: opts.keyRoot }, rng).join(' ')}>`
    }
    // arpDyad — dyads [tonic-pedal, moving scale tone] arpeggiated into 16ths: lo hi lo hi per beat.
    if (voice === 'arpDyad') {
      const highs = DYAD_HIGHS[rng.int(DYAD_HIGHS.length)]
      const lo = deg(0)
      const steps: string[] = []
      for (let b = 0; b < 4; b++) { const hi = deg(highs[b]); steps.push(String(lo), String(hi), String(lo), String(hi)) }
      return steps.join(' ')
    }
    // chordStab — syncopated TRIADS [root, 3rd, moving top]; the top voice walks for melodic interest.
    if (voice === 'chordStab') {
      const tops: El[] = [7, '~', 10, 7, '~', 5, 7, '~', 12, '~', 7, 9, '~', 7, '~', '~']
      return tops.map((t) => (t === '~' ? '~' : `[${deg(0)},${deg(3)},${deg(t as number)}]`)).join(' ')
    }
    // Chromatic/modal archetypes impose their OWN mode from the key root (independent of the track scale).
    if (voice === 'leadingTone') return phrase(PHRASES.leadingTone!, degFn(HARM_MINOR, base))
    if (voice === 'phrygianHalf') return phrase(PHRASES.phrygianHalf!, degFn(PHRYGIAN, base))
    if (voice === 'tritone') return phrase(PHRASES.tritone!, (d: number) => base + (TRITONE_SEMI[((d % TRITONE_SEMI.length) + TRITONE_SEMI.length) % TRITONE_SEMI.length] + 12 * Math.floor(d / TRITONE_SEMI.length)))
    // The remaining phrase- and line-based archetypes render straight off the track scale — DISGUISED per track
    // (seeded recombination/rotation of the cells) so the same authored shape isn't recognizable across tracks.
    const ph = PHRASES[voice]
    if (ph) return phrase(transformPhrase(ph, rng), deg)
    const ln = LINES[voice]
    return line(transformLine(ln ?? LINES.octavePulse!, rng), deg)
  }
}

// ── Phrase DISGUISE (kills cross-track recognizability) — seeded recombination + rotation of the authored cells,
//    all at the DEGREE level so it stays diatonic. Same notes, re-shaped contour → you stop recognizing the source.
function rotate<T>(a: T[], k: number): T[] { const n = a.length; if (n === 0) return a; k = ((k % n) + n) % n; return a.slice(k).concat(a.slice(0, k)) }

/** Disguise a 4-bar phrase: always re-phase the figure within each bar; sometimes reorder/swap whole bars. */
function transformPhrase(bars: El[][], rng: Rng): El[][] {
  let out = bars.map((b) => b.slice())
  out = out.map((bar) => rotate(bar, 1 + rng.int(3)))           // ALWAYS: re-phase the figure inside each bar (shared shift = stays coherent)
  if (rng.next() < 0.6 && out.length > 1) out = rotate(out, 1 + rng.int(out.length - 1)) // new entry bar
  if (rng.next() < 0.45 && out.length >= 2) {                   // light recombination: swap a pair of bars
    const i = rng.int(out.length), j = rng.int(out.length)
    const t = out[i]; out[i] = out[j]; out[j] = t
  }
  return out
}
/** Disguise a 16-step line: always rotate; sometimes recombine its 4-step cells. */
function transformLine(els: El[], rng: Rng): El[] {
  let out = rotate(els.slice(), 1 + rng.int(els.length - 1))
  if (rng.next() < 0.5) {
    const cells: El[][] = []
    for (let i = 0; i < out.length; i += 4) cells.push(out.slice(i, i + 4))
    out = rotate(cells, 1 + rng.int(Math.max(1, cells.length - 1))).flat()
  }
  return out
}

/** scale-step → midi (wraps octaves; negative steps go below the tonic, staying in the given mode). */
function degFn(scale: number[], base: number): (d: number) => number {
  const L = scale.length
  return (d: number) => base + 12 * Math.floor(d / L) + scale[((d % L) + L) % L]
}

/** Render one El to note text: rest, single step, or a stacked [a,b,…] chord/dyad. */
function renderEl(el: El, deg: (d: number) => number): string {
  if (el === '~') return '~'
  if (Array.isArray(el)) return `[${el.map(deg).join(',')}]`
  return String(deg(el))
}
/** A 4-bar phrase → `<[…] [.…] […] […]>` (one bar per cycle). */
function phrase(bars: El[][], deg: (d: number) => number): string {
  return `<${bars.map((bar) => `[${bar.map((el) => renderEl(el, deg)).join(' ')}]`).join(' ')}>`
}
/** A 16-step single-bar line → `a b ~ c …`. */
function line(els: El[], deg: (d: number) => number): string {
  return els.map((el) => renderEl(el, deg)).join(' ')
}

function pickAnti<T>(arr: readonly T[], rng: Rng, anti: AntiRepeatBuffer, cat: string): T {
  const opts = arr.map((_, i) => [String(i), 1] as Weighted<string>)
  const idx = Number(weightedPick(rng, anti.penalize(cat, opts)))
  anti.record(cat, String(idx))
  return arr[idx]
}
