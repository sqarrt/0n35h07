import type { Rng } from '../../seededRandom'
import type { Chord } from '../theory'
import { AntiRepeatBuffer } from '../AntiRepeatBuffer'
import { rotate } from '../seqDisguise'
import { pickAxis } from './leadAxes'
import { LEAD_RHYTHMS, onsetCount, type LeadRhythm } from './leadRhythm'
import { LEAD_MELODIES, emitMelody } from './leadMelody'
import { combineLead } from './leadCombine'
import { LEAD_COLORS, RESTFUL_COLOR_IDS } from './leadColor'

// A lead is now THREE independently-chosen axes (note 8): РИСУНОК (rhythm — leadRhythm) × МЕЛОДИЯ (notes incl.
// voicing — leadMelody) × ЦВЕТ (synth/FX — leadColor → the composer's LEAD_VOICES). The ENGINE picks the axes
// (mood-guarded anti-repeat), combines rhythm×melody into absolute-MIDI note content, and tags a colour `voice`;
// the COMPOSER renders the per-voice synth/FX chain. Patterns are ABSOLUTE MIDI (no Strudel .scale()).

// `voice` selects the composer's synth+FX chain.
export type LeadVoiceId =
  | 'arpDyad' | 'atmoDyad' | 'chordStab' | 'lament' | 'callResponse' | 'octavePulse'
  | 'bellMelody' | 'stutterStab' | 'leadingTone' | 'phrygianHalf' | 'doubleStop'
  | 'glitchStorm' | 'tritone' | 'glassArp' | 'ghostVoice' | 'detunedDrift' | 'warpedBox' | 'crushBell'
  | 'fogMelody' | 'digitalChime' | 'rustString' | 'digitalRain' // co-designed CALM/atmospheric (Silent Hill + virtual)
  | 'genWalk' | 'genWeave'  // PROCEDURAL — kept in the union for back-compat; no longer separately selected

export interface LeadMotif { pattern: string; voice: LeadVoiceId }
export interface LeadState { motif: LeadMotif | null; phrasesLeft: number }
const REPHRASE = 999

export function initialLeadState(): LeadState { return { motif: null, phrasesLeft: 0 } }

export interface LeadOpts {
  rng: Rng; leadOctave: number; density: number
  scale?: number[]; keyRoot?: number; anti?: AntiRepeatBuffer
  moodId: string
}

const DEFAULT_SCALE = [0, 2, 3, 5, 7, 8, 10] // aeolian fallback
const BREAK_RHYTHM: LeadRhythm = LEAD_RHYTHMS.find((r) => r.id === 'airy') ?? LEAD_RHYTHMS[0] // sparse → restful

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

  /** Build one movement's lead: pick rhythm × melody × colour INDEPENDENTLY (mood-guarded anti-repeat), then
   *  lay the melody onto the rhythm's onsets → absolute-MIDI note content. Colour is decoupled from the pattern. */
  private makeMotif(opts: LeadOpts): LeadMotif {
    const base = (opts.keyRoot ?? 0) + 12 * (opts.leadOctave - 3)
    const deg = degFn(opts.scale ?? DEFAULT_SCALE, base)
    const rhythm = pickAxis(LEAD_RHYTHMS, opts.moodId, opts.rng, opts.anti, 'lead_rhythm')
    const melody = pickAxis(LEAD_MELODIES, opts.moodId, opts.rng, opts.anti, 'lead_melody')
    const color = pickAxis(LEAD_COLORS, opts.moodId, opts.rng, opts.anti, 'lead_color')
    let els = emitMelody(melody, opts.rng, onsetCount(rhythm))
    els = rotate(els, els.length ? opts.rng.int(els.length) : 0) // light disguise — rotate the contour start
    return { pattern: combineLead(rhythm, els, deg), voice: color.voice }
  }

  /** Pick a RESTFUL lead for a BREAK (different colour from the track's main lead `avoid`): a sparse rhythm + a
   *  mono melody, rendered by the caller through the break's low-gain, echo-drowned chain so it rests the ears. */
  buildBreakLead(opts: LeadOpts, avoid?: LeadVoiceId): { pattern: string; voice: LeadVoiceId } {
    const base = (opts.keyRoot ?? 0) + 12 * (opts.leadOctave - 3)
    const deg = degFn(opts.scale ?? DEFAULT_SCALE, base)
    const colors = LEAD_COLORS.filter((c) => RESTFUL_COLOR_IDS.includes(c.id) && c.voice !== avoid)
    const color = colors[opts.rng.int(colors.length)]
    const melodies = LEAD_MELODIES.filter((m) => m.voicing === 'mono')
    const melody = melodies[opts.rng.int(melodies.length)]
    const els = emitMelody(melody, opts.rng, onsetCount(BREAK_RHYTHM))
    return { pattern: combineLead(BREAK_RHYTHM, els, deg), voice: color.voice }
  }
}

/** scale-step → midi (wraps octaves; negative steps go below the tonic, staying in the given mode). */
function degFn(scale: number[], base: number): (d: number) => number {
  const L = scale.length
  return (d: number) => base + 12 * Math.floor(d / L) + scale[((d % L) + L) % L]
}
