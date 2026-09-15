import type { MoodTagged } from './leadAxes'

// BG tonal-ACCENT decomposition (note 8 stage 5): the memorable bg pings (sonar/bell/morse/…) split into three
// axes so they combine freely — РИСУНОК (the struct: when it pings) × МЕЛОДИЯ (semitone offsets from the bed root,
// or a slow arp) × ЦВЕТ (the synth+fx timbre). The textural BEDS (hiss/drone/…) stay as their colour pool, and the
// note-5 foley (drip/steps/thud) stays bespoke. Combined by bgAccentBody; the composer adds gain/pan/fx.
export const BG_STRUCTS = [
  'x ~ x ~ x ~ x ~', 'x ~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ x ~ ~ ~', 'x x ~ x ~ ~ x ~',
  'x ~ ~ x ~ x ~ ~', 'x ~ ~ ~ x ~ ~ ~', '~ x ~ ~ ~ x ~ ~', 'x ~ x ~ ~ ~ x ~',
]

// Semitone offsets from the bed root. `arp` = play the offsets as a slow melodic sequence (no struct).
export interface BgMelody extends MoodTagged { offs: number[]; arp?: boolean }
export const BG_MELODIES: BgMelody[] = [
  { id: 'subLow', offs: [-12] },
  { id: 'high', offs: [24] },
  { id: 'fifth', offs: [7] },
  { id: 'twelfth', offs: [12] },
  { id: 'nineteenth', offs: [19] },
  { id: 'arp', offs: [0, 3, 7, 10], arp: true },
  { id: 'dyad', offs: [-12, -5], arp: true },
  { id: 'octaves', offs: [0, 12], arp: true },
]

// The synth source + fx chain (everything after note().struct()).
export interface BgTimbre extends MoodTagged { fx: string }
export const BG_TIMBRES: BgTimbre[] = [
  { id: 'soft', fx: '.s("sine").attack(0.04).release(0.5).lpf(180)' },
  { id: 'ping', fx: '.s("sine").decay(0.4)' },
  { id: 'metal', fx: '.s("sine").fm(8).fmh(3.3).decay(0.25)' },
  { id: 'morse', fx: '.s("square").decay(0.05).lpf(2000)' },
  { id: 'bell', fx: '.s("sine").fm(2.5).fmh(1.41).attack(0.001).decay(3).lpf(1400).distort("1.05:0.2")' },
  { id: 'pluck', fx: '.s("sawtooth").decay(0.2).lpf(1200).lpq(6)' },
]

/** Combine a bg accent: an arp melody → a slowed note sequence; a single offset → a struck note. `struct` is the
 *  already-rotated pattern; the composer appends gain/pan/fx. */
export function bgAccentBody(struct: string, melody: BgMelody, timbre: BgTimbre, root: number): string {
  if (melody.arp) return `note("${melody.offs.map((o) => root + o).join(' ')}").slow(2)${timbre.fx}`
  return `note("${root + melody.offs[0]}").struct("${struct}")${timbre.fx}`
}
