import type { Rng } from '../../seededRandom'
import { saturationShape } from '../fx'

const STEPS = 16

export class BassEngine {
  /**
   * 303-style acid bass: a 16-step pattern of *offsets* (root / octave pop / fifth /
   * rest) that is transposed per cycle by `.add(note("<r0 r1 ...>"))` so the bass
   * FOLLOWS the chord progression (in lockstep with the pad), instead of droning on
   * one root. Accents on the downbeats; resonant `.lpq` + `acidenv` give the squelch.
   */
  buildBass(
    opts: {
      rng: Rng; roots: number[]; sound: string
      // acidenv is the EXPRESSION placed inside .acidenv(...): a number string OR a
      // moving signal (e.g. "saw.range(.3,.6).slow(8)") so the squelch never sits still.
      saturation: number; acidenv?: string; rest?: number; groove?: boolean[]
    },
  ): string {
    // The bass MUSCLE never goes silent while it's playing: EVERY step sounds (no '~').
    // Groove/sparseness is expressed by DYNAMICS — the groove mask's "off" steps become
    // quiet ghost notes, not gaps — so it never sounds like a sparse low lead.
    const ghost = Math.max(0.18, 0.52 - (opts.rest ?? 0.12) * 0.6) // sparser groove → quieter ghosts
    const offsets: string[] = []
    const gains: string[] = []
    for (let i = 0; i < STEPS; i++) {
      const on = opts.groove ? opts.groove[i] !== false : true
      const r = opts.rng.next()
      const o = r < 0.1 ? '12' : r < 0.16 ? '7' : '0' // mostly root, occasional octave/fifth
      offsets.push(o)
      const accent = i % 4 === 0 ? 1 : i % 2 === 0 ? 0.82 : 0.62
      gains.push(String(on ? accent : Math.round(accent * ghost * 100) / 100))
    }
    const roots = opts.roots.length > 0 ? opts.roots.join(' ') : '36'
    const acidenv = opts.acidenv ?? '0.4'
    const sat = saturationShape(opts.saturation)
    // No .lpf here — the composer appends it (a number, or a swept signal in builds).
    return (
      `note("${offsets.join(' ')}").add(note("<${roots}>")).s("${opts.sound}")` +
      `.acidenv(${acidenv}).lpq(9).attack(0.006).dec(0.16)` +
      `.gain("${gains.join(' ')}")${sat}`
    )
  }
}
