import type { TrackDescriptor } from './trackDescriptor'

function djb2hex(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(16).slice(-4)
}

// Structural input: satisfied by MusicalState ({mood,bpm,trackSeed}) and by a TrackDescriptor (trackSeedOf).
export function radioTrackName(t: { mood: string; bpm: number; trackSeed: string }): string {
  return `${t.mood}_${t.bpm}bpm_${djb2hex(t.trackSeed)}`
}

/** A descriptor's per-track seed (the deterministic RNG seed): `${seed}:t${index}`. */
export function trackSeedOf(d: TrackDescriptor): string {
  return `${d.seed}:t${d.index}`
}

