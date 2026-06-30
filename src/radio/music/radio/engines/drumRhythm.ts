import type { MoodTagged } from './leadAxes'

// РИСУНОК axis: the groove — kick/hat/snare/clap step patterns + swing (+ optional ghost/rim layers). Migrated from
// the old DRUM_KITS (amen/industrial/broken/minimal) and the four-floor KICK/HAT/CLAP pools. Decoupled from SOUND.
export interface DrumRhythm extends MoodTagged {
  kick: string; hat: string; snare: string; clap: string
  ghost?: string; rim?: string; swing: number
}
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
export const DRUM_RHYTHMS: DrumRhythm[] = [
  { id: 'amen', kick: 'bd ~ ~ bd ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~', hat: 'hh*16', snare: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd ~', clap: '~ cp ~ cp', ghost: '~ ~ sd ~ ~ sd ~ ~ ~ sd ~ ~ ~ sd ~ ~', swing: 0.06 },
  { id: 'industrial', kick: 'bd*4', hat: 'white*16', snare: '~ cp ~ cp', clap: '~ cp ~ cp', swing: 0, moods: HARD },
  { id: 'broken', kick: 'bd ~ ~ bd ~ ~ bd ~ ~ bd ~ bd ~ ~ bd ~', hat: 'hh*16', snare: '~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ cp', clap: '~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ cp', swing: 0.13 },
  { id: 'minimal', kick: 'bd*4', hat: '~ hh ~ hh', snare: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', clap: '~ cp ~ cp', rim: '~ rim ~ rim', swing: 0 },
  { id: 'fourFloor', kick: 'bd*4', hat: 'hh*8', snare: '~ sd ~ sd', clap: '~ cp ~ cp', swing: 0 },
  { id: 'fourOff', kick: 'bd*4', hat: 'hh ~ hh ~ hh ~ hh hh', snare: '~ sd ~ sd', clap: '~ cp ~ [cp cp]', swing: 0 },
  { id: 'rollingDub', kick: 'bd ~ ~ bd ~ ~ bd ~', hat: '[hh hh] hh hh hh', snare: '~ ~ ~ sd', clap: '~ ~ cp ~', rim: '~ rim ~ rim', swing: 0.05, moods: CALM },
  { id: 'euclid', kick: 'bd(5,8)', hat: 'hh*12', snare: '~ ~ sd ~', clap: '~ cp', swing: 0 },
  { id: 'sparseHyp', kick: 'bd ~ ~ bd ~ ~ bd ~', hat: '~ hh ~ hh', snare: '~ ~ ~ ~ ~ ~ sd ~', clap: '~ ~ ~ cp', swing: 0, moods: CALM },
]
