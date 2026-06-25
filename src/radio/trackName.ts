import type { MusicalState } from './music/radio/MusicalState'

function djb2hex(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(16).slice(-4)
}

export function radioTrackName(state: MusicalState): string {
  return `${state.mood}_${state.bpm}bpm_${djb2hex(state.trackSeed)}`
}
