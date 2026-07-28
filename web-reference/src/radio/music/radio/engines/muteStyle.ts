import type { Rng } from '../../seededRandom'

// MUTE / palm-mute dynamics (the "Vysotsky strum" — down-mute-up-down-up-mute). A per-track gesture: on certain
// 16th steps the targeted layers are damped, adding rhythmic dynamics. Two mechanisms: a deep PALM-mute (the note
// is killed to a dull "chk") or a softer GAIN-duck. Scope is seeded — lead only / bass only / both / the whole
// track / none. Applied downstream as a multiplicative `.gain("<16 steps>")` on the targeted layers (so it never
// fights the per-layer filter sweeps). Picked once per track from a dedicated muteRng → consistent + cascade-free.
export interface MuteRoll { gain: string | null; lead: boolean; bass: boolean; drums: boolean }

const MUTE_CHANCE = 0.5         // ~half the tracks get a mute gesture; the rest play straight
const PALM_DEPTH = 0.08         // palm-mute: the muted step is nearly killed (a damped "chk")
const DUCK_DEPTH = 0.3          // gain-duck: the muted step is just dipped
const PALM_VS_DUCK = 0.5        // 50/50 which mechanism

// 16-step strum masks — 'x' plays, 'm' is muted. Curated to feel like a damped guitar/synth strum.
const MUTE_PATTERNS = [
  'x x m x x x m x x x m x x x m x',
  'x m x m x m x m x m x m x m x m',
  'x x x m x x x m x x x m x x x m',
  'x x m m x x m m x x m m x x m m',
  'm x x x m x x x m x x x m x x x',
  'x x x x m m x x x x x x m m x x',
  'x m m x x m m x x m m x x m m x',
  'x x x m x x m x x x m x x m x x',
]
// Scope → which layers the mute hits. Weighted toward the lighter scopes; 'all' (whole-track duck) is rarer.
const SCOPES: ('lead' | 'bass' | 'leadbass' | 'all')[] = ['lead', 'lead', 'bass', 'bass', 'leadbass', 'all']

/** Roll the per-track mute gesture (or none). Deterministic from the given rng. */
export function rollMute(rng: Rng): MuteRoll {
  if (rng.next() >= MUTE_CHANCE) return { gain: null, lead: false, bass: false, drums: false }
  const pattern = MUTE_PATTERNS[rng.int(MUTE_PATTERNS.length)]
  const depth = rng.next() < PALM_VS_DUCK ? PALM_DEPTH : DUCK_DEPTH
  const gain = pattern.split(' ').map((t) => (t === 'm' ? String(depth) : '1')).join(' ')
  const scope = SCOPES[rng.int(SCOPES.length)]
  return {
    gain,
    lead: scope === 'lead' || scope === 'leadbass' || scope === 'all',
    bass: scope === 'bass' || scope === 'leadbass' || scope === 'all',
    drums: scope === 'all',
  }
}
