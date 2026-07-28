import type { Rng } from '../../seededRandom'
import { AntiRepeatBuffer } from '../AntiRepeatBuffer'
import { weightedPick, type Weighted } from '../weighted'

// Each lead axis variant (rhythm / melody / colour) carries an optional mood allowlist — the SOFT guard. Absent =
// compatible with any mood. The picker filters by mood, then weighted-picks with per-category anti-repeat.
export interface MoodTagged { id: string; moods?: string[] }

const MIN_SURVIVORS = 2 // below this the mood filter is too tight → fall back to the full catalog (never empty)

/** Pick one axis variant: mood-filter → fall back to all if <2 survive → weighted anti-repeat pick by id. */
export function pickAxis<T extends MoodTagged>(
  catalog: readonly T[], moodId: string, rng: Rng, anti: AntiRepeatBuffer | undefined, cat: string,
): T {
  const compatible = catalog.filter((it) => !it.moods || it.moods.includes(moodId))
  const pool = compatible.length >= MIN_SURVIVORS ? compatible : catalog
  if (!anti) return pool[rng.int(pool.length)]
  const entries = pool.map((it) => [`${cat}:${it.id}`, 1] as Weighted<string>)
  const key = weightedPick(rng, anti.penalize(cat, entries))
  anti.record(cat, key)
  return pool.find((it) => `${cat}:${it.id}` === key)!
}
