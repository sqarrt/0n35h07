import type { MoodTagged } from './leadAxes'

// ЦВЕТ axis: synth source + fx character + optional filter. `acid:true` = the bespoke 303 path (BassEngine), which
// ignores the rhythm/melody axes. Positional accents were moved to bassRhythm.accent, so these fx are accent-free.
export interface BassColor extends MoodTagged {
  src?: string; fx?: string; filt?: (n: number, lateAlign: string) => string; acid?: boolean
}
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
export const BASS_COLORS: BassColor[] = [
  { id: 'acid', acid: true },   // bespoke — runs BassEngine with its own root-pulse melody/rhythm
  { id: 'supersawDrive', src: '.s("supersaw").unison(5).detune(0.4)', fx: '.acidenv(0.7).lpq(9).distort("1.2:0.3")' },
  { id: 'bitcrush', src: '.s("supersaw").unison(3).detune(0.4)', fx: '.crush(4).distort("1.3:0.45").release(0.14).lpq(5).acidenv(0.4)', moods: HARD },
  { id: 'wobble', src: '.s("supersaw").unison(5).detune(0.5)', fx: '.lpq(13).distort("1.4:0.45")', filt: (n, la) => `.lpf(sine.range(160, 1700).slow(${Math.max(2, n)})${la})` },
  { id: 'chromaSaw', src: '.s("supersaw").unison(5).detune(0.45).fm(2).fmh(2.51)', fx: '.lpq(6).distort("1.4:0.45")', filt: (_n, la) => `.lpf(saw.range(200, 1100).slow(2)${la})`, moods: HARD },
  { id: 'horror', src: '.s("supersaw").unison(3).detune(0.4)', fx: '.ply("<1 1 2 1 1 3 1 2>").crush("<8 5 8 4>").distort("1.5:0.5").lpq(7)', filt: () => '.lpf(perlin.range(220, 1700).fast(2))', moods: HARD },
  { id: 'wtFlute', src: '.s("wt_flute").unison(2)', fx: '.wt(0).wtenv(0.7).acidenv(0.45).distort("4:0.5").dec(0.13).lpq(2).fm("<1 ~ ~ 2>")', moods: CALM },
  { id: 'wtDigital', src: '.s("wt_digital").unison(2)', fx: '.wt(0).wtenv(0.5).acidenv(0.4).distort("3:0.4").dec(0.15).lpq(4)' },
  { id: 'cleanSub', src: '.s("sawtooth")', fx: '.lpq(3)', moods: CALM },
]
