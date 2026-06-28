import type { Rng } from '../seededRandom'

export type Weighted<T> = readonly [T, number]

/** Pick one item proportionally to its (non-negative) weight via a single rng draw. */
export function weightedPick<T>(rng: Rng, entries: readonly Weighted<T>[]): T {
  if (entries.length === 0) throw new Error('weightedPick: empty entries')
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0)
  if (total <= 0) return entries[0][0]
  let r = rng.next() * total
  for (const [item, w] of entries) {
    r -= Math.max(0, w)
    if (r < 0) return item
  }
  return entries[entries.length - 1][0]
}
