// Deterministic PRNG from a string seed. The same seed yields the same sequence
// on every machine, which is what guarantees both players hear the same match.
// xmur3 (string -> 32-bit hash) seeds mulberry32 (fast 32-bit generator).

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  /** Next float in [0, 1). */
  next(): number
  /** Pick one element (undefined for an empty array). */
  pick<T>(items: readonly T[]): T | undefined
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number
}

export function createRng(seed: string): Rng {
  const seedFn = xmur3(seed)
  const rand = mulberry32(seedFn())
  const next = () => rand()
  return {
    next,
    pick: <T>(items: readonly T[]): T | undefined =>
      items.length === 0 ? undefined : items[Math.floor(next() * items.length)],
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
  }
}

/** Short human-friendly seed, e.g. for a "reroll" button. */
export function randomSeed(): string {
  return Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .toUpperCase()
    .padStart(6, '0')
}
