import type { MoodTagged } from './leadAxes'

// МЕЛОДИЯ axis: SEMITONE offsets consumed at each rhythm onset (looped). `.add(note("<roots>"))` adds the per-bar
// root downstream. `drift` = a slow downward pitch slide; `shove` = an optional per-bar transpose string.
export interface BassMelody extends MoodTagged { offs: number[]; drift?: boolean; shove?: string }
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
export const BASS_MELODIES: BassMelody[] = [
  { id: 'rootHold', offs: [0] },
  { id: 'tritoneStab', offs: [0, 0, 0, 6, 0, 0, 0, 0], moods: HARD },
  { id: 'fifthDub', offs: [0, 0, 5, 0, 0, 0, 7, 0], moods: CALM },
  { id: 'wtRun', offs: [0, 6, 0, 5, 4, 0] },
  { id: 'minorWalk', offs: [0, 3, 5, 3, 0, -2] },
  { id: 'chromaSlide', offs: [0], drift: true, moods: HARD },
  { id: 'horrorShove', offs: [0], shove: '.add(note("<0 0 6 0>"))', moods: HARD },
  { id: 'octaveBounce', offs: [0, 0, 12, 0], moods: CALM },
]
