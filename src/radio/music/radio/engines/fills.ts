import type { Rng } from '../../seededRandom'

// Transition-FILL content variety (note 8 stage 4). Each device used to play ONE fixed pattern every time it fired;
// now it picks a pattern from a pool (РИСУНОК), seeded per-occurrence, and the drum ones inherit the track's kit
// bank (ЦВЕТ). Tonal devices (subDrop / melodic exit-fill) already vary their pitch (МЕЛОДИЯ) via descSubRun /
// descCadence. Patterns are the inner `s("…")` bodies; the composer wraps them with lastBar/firstBar + gain/fx.
export const FILL_SNARE_ROLLS = [
  'sd*4 sd*8', 'sd*8 sd*16', 'sd ~ [sd*2] [sd*4]', '[sd*2 sd*4] [sd*8 sd*16]', '~ [sd*4] [sd*8 sd*16]', 'sd*4 [sd*8 sd*16]',
]
export const FILL_TOM_ROLLS = [
  'lt mt lt mt lt mt lt mt', 'lt lt mt mt ht ht mt lt', 'lt mt ht mt lt mt ht mt', 'lt ~ mt ~ ht ~ mt lt',
  'lt mt lt mt ht ht ht ht', 'ht mt lt mt ht mt lt lt',
]
export const FILL_RISERS = ['white*16', 'white*8', 'white*32', '[white*8 white*16]', 'white*12']
export const FILL_CRASHES = ['white', 'white white', '[white ~]', '[~ white]']
export const FILL_RHYTHMIC_EXIT = [
  '[bd ~ sd ~ bd sd [sd sd] [sd*4]]', '[bd sd bd sd [sd sd] [sd*4] sd*8 sd*16]',
  '[bd ~ bd sd ~ sd [sd*4] [sd*8]]', '[~ sd sd [sd*2] bd [sd*4] ~ [sd*8]]',
]

/** Seeded pick of a fill variant from a pool. */
export function pickFill(pool: readonly string[], rng: Rng): string { return pool[rng.int(pool.length)] }
