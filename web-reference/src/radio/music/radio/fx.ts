// Techno FX fragments appended to layer code by the composer. Pure string output
// (no Strudel import) — validated by unit tests for shape, by ear for taste.

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Fake sidechain: a per-bar ducking gain pattern `[dip 1@3]` (low on the kick,
 * recovering over the bar). Multiplies with the layer's base gain. Depth 0..1.
 * Returns '' when depth ≤ 0.
 */
export function sidechainGain(depth: number): string {
  if (depth <= 0) return ''
  const dip = clamp(1 - depth * 0.7, 0.1, 1)
  // Smooth 4-on-the-floor pump: gain dips to `dip` on each beat and ramps back up
  // — the classic sidechain "breathing", continuous rather than a stepped pattern.
  return `.gain(saw.range(${r2(dip)}, 1).fast(4))`
}

/**
 * Waveshaping saturation via `.shape()`, scaled down from the mood's saturation
 * so it stays musical (max 0.5). Returns '' when amount ≤ 0.
 */
export function saturationShape(amount: number): string {
  if (amount <= 0) return ''
  const amt = clamp(amount * 0.4, 0, 0.5)
  return `.shape(${r2(amt)})`
}
