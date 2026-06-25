// Tunable constants for the Radio generative core. Pure data — no I/O, no browser.
export interface RadioConfig {
  /** null = derive a fresh seed at startup; a string = reproducible session. */
  seed: string | null
  /** Sections to play before rotating mood. */
  moodRotationSections: number
  /** Ring-buffer size for anti-repeat penalties. */
  antiRepeatWindow: number
  /** Default section length in bars. */
  sectionLengthBars: number
  /** How often (in bars) to lock a fresh melodic motif. */
  motifLockEveryBars: number
  /** Max step of the timbre parameter random walk, as a fraction of each range. */
  driftStepMax: number
  /** Sections played before a new track (fixed BPM/mood/key) begins. */
  sectionsPerTrack: number
  /** Octave the lead sits in (C3 = octave 3). */
  leadOctave: number
  /** 0..1 fraction of the 16-step bar the lead's rhythm mask fills. */
  leadDensity: number
  /** Octave the bass sits in. */
  bassOctave: number
}

export const DEFAULT_RADIO_CONFIG: RadioConfig = {
  seed: null,
  moodRotationSections: 8,
  antiRepeatWindow: 6,
  sectionLengthBars: 8,
  motifLockEveryBars: 12,
  driftStepMax: 0.05,
  sectionsPerTrack: 8,
  leadOctave: 3,
  leadDensity: 0.5,
  bassOctave: 1, // main bass at C1–B1 (was C2–B2 — too high); sub follows an octave below
}

const NUMERIC_KEYS = [
  'moodRotationSections', 'antiRepeatWindow', 'sectionLengthBars', 'motifLockEveryBars', 'driftStepMax',
  'sectionsPerTrack', 'leadOctave', 'leadDensity', 'bassOctave',
] as const

/** Storage key holding a JSON partial RadioConfig (for debugging tweaks). */
export const RADIO_CONFIG_STORAGE_KEY = 'radioConfig'

/**
 * Merge DEFAULT_RADIO_CONFIG with a partial override read from `storage`
 * (defaults to `localStorage` in the browser). Wrong-typed fields and invalid
 * JSON are ignored — a bad override falls back to defaults, never throws.
 */
export function loadRadioConfig(storage?: Pick<Storage, 'getItem'>): RadioConfig {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
  const out: RadioConfig = { ...DEFAULT_RADIO_CONFIG }
  const raw = store?.getItem(RADIO_CONFIG_STORAGE_KEY)
  if (!raw) return out
  let parsed: Partial<Record<keyof RadioConfig, unknown>>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return out
  }
  if (typeof parsed.seed === 'string' || parsed.seed === null) out.seed = parsed.seed
  for (const k of NUMERIC_KEYS) {
    const v = parsed[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}
