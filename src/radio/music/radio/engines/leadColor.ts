import type { MoodTagged } from './leadAxes'
import type { LeadVoiceId } from './MelodyEngine'

// ЦВЕТ axis: which synth/FX chain (the composer's LEAD_VOICES) renders the notes. Decoupled from pattern. Only the
// most aggressive/atmospheric voices carry a mood tag (soft guard); the rest fit any mood.
export interface LeadColor extends MoodTagged { voice: LeadVoiceId }

const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']

export const LEAD_COLORS: LeadColor[] = [
  { id: 'chordStab', voice: 'chordStab' },
  { id: 'callResponse', voice: 'callResponse' },
  { id: 'octavePulse', voice: 'octavePulse' },
  { id: 'bellMelody', voice: 'bellMelody' },
  { id: 'stutterStab', voice: 'stutterStab', moods: HARD },
  { id: 'doubleStop', voice: 'doubleStop' },
  { id: 'glitchStorm', voice: 'glitchStorm', moods: HARD },
  { id: 'glassArp', voice: 'glassArp' },
  { id: 'ghostVoice', voice: 'ghostVoice' },
  { id: 'detunedDrift', voice: 'detunedDrift' },
  { id: 'warpedBox', voice: 'warpedBox' },
  { id: 'crushBell', voice: 'crushBell' },
  { id: 'fogMelody', voice: 'fogMelody', moods: CALM },
  { id: 'digitalChime', voice: 'digitalChime' },
  { id: 'rustString', voice: 'rustString', moods: CALM },
  { id: 'digitalRain', voice: 'digitalRain' },
  { id: 'atmoDyad', voice: 'atmoDyad', moods: CALM },
]

/** Restful colours for the break (calm-tagged or untagged-but-atmospheric). */
export const RESTFUL_COLOR_IDS = ['atmoDyad', 'callResponse', 'bellMelody', 'ghostVoice', 'glassArp', 'detunedDrift', 'warpedBox', 'crushBell', 'fogMelody', 'digitalChime', 'rustString', 'digitalRain']
