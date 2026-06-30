import type { MoodTagged } from './leadAxes'

// НАБОР axis: which sample bank renders the whole kit (kick + snare + hat + clap). Coherent kits set one bank;
// hybrids override per drum. An empty bank = the default dirt/EmuSP12 samples (the legacy sound). Migrated from
// the kick-only KICK_VOICES — now the bank applies to the whole kit.
export interface DrumKit extends MoodTagged {
  kickBank: string; kickN: number
  snareBank?: string; hatBank?: string; clapBank?: string
}
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
export const DRUM_KITS_SND: DrumKit[] = [
  { id: 'tr909', kickBank: 'RolandTR909', kickN: 0 },
  { id: 'tr808', kickBank: 'RolandTR808', kickN: 0, moods: [...CALM, 'dark_techno'] },
  { id: 'tr707', kickBank: 'RolandTR707', kickN: 0 },
  { id: 'tr606', kickBank: 'RolandTR606', kickN: 0, moods: HARD },
  { id: 'tr505', kickBank: 'RolandTR505', kickN: 0 },
  { id: 'linn', kickBank: 'AkaiLinn', kickN: 0 },
  { id: 'dirt', kickBank: '', kickN: 0 },            // the original dirt bd kit
  { id: 'dirtB', kickBank: '', kickN: 5 },           // dirt bd variant
  { id: 'hybrid808x909', kickBank: 'RolandTR808', kickN: 0, hatBank: 'RolandTR909', clapBank: 'RolandTR909' },
  { id: 'hybrid606dirt', kickBank: 'RolandTR606', kickN: 0, snareBank: '', hatBank: '', moods: HARD },
]

/** A drum's bank, defaulting to the kick bank when unset (a coherent single-bank kit). */
export function kitBankOf(kit: DrumKit, drum: 'snare' | 'hat' | 'clap'): string {
  const b = drum === 'snare' ? kit.snareBank : drum === 'hat' ? kit.hatBank : kit.clapBank
  return b ?? kit.kickBank
}
