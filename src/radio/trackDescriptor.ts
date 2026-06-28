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

/** One rendered section of a baked track: its exact Strudel program + how many bars it plays. */
export interface BakedSection { code: string; bars: number }
/** A track "baked" at save time — the full arc's Strudel code + its frozen name — so a saved favorite
 *  plays back EXACTLY as it sounded, immune to later changes in the generation algorithm. */
export interface BakedTrack { name: string; sections: BakedSection[] }
/** A saved favorite = the track's identity (descriptor) PLUS the baked render. Older favorites have no
 *  `baked` and fall back to deterministic regeneration from seed+index. */
export interface FavoriteTrack extends TrackDescriptor { baked?: BakedTrack }
