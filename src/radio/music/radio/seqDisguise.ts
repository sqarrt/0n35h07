import type { Rng } from '../seededRandom'

function rotate<T>(a: T[], k: number): T[] { const n = a.length; if (n === 0) return a; k = ((k % n) + n) % n; return a.slice(k).concat(a.slice(0, k)) }

/**
 * Disguise a step-sequence pattern (space-separated tokens, with `_` holds and `~` rests) by reordering its NOTE
 * CELLS — a note token plus its trailing `_` holds. Same notes and the same durations, a re-shaped contour, total
 * length unchanged → the fixed authored riff stops being recognizable across tracks. Seeded → deterministic.
 * No-ops for single-token / repeated patterns (e.g. "0*16") — there's nothing to disguise.
 */
export function disguiseCells(pattern: string, rng: Rng): string {
  if (!pattern.includes(' ')) return pattern
  const toks = pattern.split(/\s+/).filter(Boolean)
  const cells: string[][] = []
  for (const tk of toks) {
    if (tk === '_' && cells.length) cells[cells.length - 1].push(tk) // a hold belongs to the preceding note cell
    else cells.push([tk])
  }
  if (cells.length < 2) return pattern
  const out = rotate(cells, 1 + rng.int(cells.length - 1))          // re-enter the riff at a different cell
  if (rng.next() < 0.4 && out.length >= 2) {                        // light recombination: swap a pair of cells
    const i = rng.int(out.length), j = rng.int(out.length)
    const t = out[i]; out[i] = out[j]; out[j] = t
  }
  return out.flat().join(' ')
}
