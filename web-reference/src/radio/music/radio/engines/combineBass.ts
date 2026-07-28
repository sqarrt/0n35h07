import { bassOnsets, type BassRhythm } from './bassRhythm'

/** Lay the semitone-offset contour onto the rhythm mask → a 16-token pattern ('x'→next offset looped, '_'/'~' kept). */
export function combineBass(rhythm: Pick<BassRhythm, 'mask'>, offs: number[]): string {
  const tokens = rhythm.mask.trim().split(/\s+/)
  let k = 0
  return tokens.map((t) => {
    if (t === 'x') { const v = offs[k % offs.length]; k++; return String(v) }
    return t // '_' sustain or '~' rest
  }).join(' ')
}
// bassOnsets is re-exported for symmetry with the other axes (used by tests/tools).
export { bassOnsets }
