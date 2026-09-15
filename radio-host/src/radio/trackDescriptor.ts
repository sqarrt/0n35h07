// Compact, comparable identity of a generated track. A track is fully reproducible from {seed, index}
// (deterministic RNG); the other fields are kept for the library/favorites labels.

export interface TrackStyleId { kick: string; bass: string; lead: string; bg: string; perc: string }

export interface TrackDescriptor {
  seed: string
  index: number
  mood: string
  key: string
  scaleName: string
  bpm: number
  style: TrackStyleId
}

/** Two descriptors refer to the same track iff their seed+index match (the rest is derived). */
export function sameTrack(a: TrackDescriptor, b: TrackDescriptor): boolean {
  return a.seed === b.seed && a.index === b.index
}

/** A track "baked" at save time as ONE self-contained arrange() program — so a saved favorite plays back
 *  EXACTLY as it sounded (and is copy-pasteable into strudel.cc), immune to later generation changes.
 *  `info` is display-only; `bars` is the total length (for scheduling the loop / queue auto-advance). */
export interface BakedTrack {
  name: string
  bpm: number
  bars: number
  info: { mood: string; key: string; scale: string }
  program: string
}
