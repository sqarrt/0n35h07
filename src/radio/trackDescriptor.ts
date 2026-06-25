// Compact, comparable identity of a generated track. A track is fully reproducible from {seed, index}
// (deterministic RNG); the other fields are kept for the favorites UI labels and like/dislike biasing.

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
