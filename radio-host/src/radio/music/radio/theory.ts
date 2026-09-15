// Pure note/scale/chord math. MIDI convention: C-1 = 0, so C3 = 48.

export const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}
const SEMITONE_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const ROMAN_TO_DEGREE: Record<string, number> = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 }

export interface Chord { roman: string; notes: number[]; durationBars: number; label: string }
export type ChordSequence = Chord[]

/** Absolute MIDI of a key's root in octave `oct` (C3 = 48). */
export function keyRootMidi(key: string, oct = 3): number {
  const semis = NOTE_TO_SEMITONE[key]
  if (semis === undefined) throw new Error(`unknown key: ${key}`)
  return 12 * (oct + 1) + semis
}

/** MIDI note for a (possibly out-of-range) scale degree index, wrapping octaves. */
export function scaleDegreeToMidi(rootMidi: number, scale: number[], degree: number): number {
  const n = scale.length
  const oct = Math.floor(degree / n)
  const idx = ((degree % n) + n) % n
  return rootMidi + 12 * oct + scale[idx]
}

export function parseRoman(roman: string): number {
  const deg = ROMAN_TO_DEGREE[roman.toLowerCase()]
  if (deg === undefined) throw new Error(`unknown roman numeral: ${roman}`)
  return deg
}

function chordLabel(notes: number[], extension: string): string {
  const root = notes[0]
  const name = SEMITONE_TO_NOTE[((root % 12) + 12) % 12]
  const third = notes[1] - root
  const quality = third <= 3 ? 'm' : '' // minor 3rd = 3 semitones, major = 4
  return `${name}${quality}${extension}`
}

/** Build a chord by stacking scale thirds from the roman-numeral degree. */
export function buildChord(
  rootMidi: number, scale: number[], roman: string, extension: '' | '7' | '9', durationBars: number,
): Chord {
  const base = parseRoman(roman)
  const degs = [base, base + 2, base + 4]
  if (extension === '7' || extension === '9') degs.push(base + 6)
  if (extension === '9') degs.push(base + 8)
  const notes = degs.map((d) => scaleDegreeToMidi(rootMidi, scale, d))
  return { roman, notes, durationBars, label: chordLabel(notes, extension) }
}

/** Octave-shift a chord as a block so its mean sits near the previous chord's. */
export function voiceLead(notes: number[], prevMeanMidi: number | null): number[] {
  if (prevMeanMidi === null) return notes
  const mean = notes.reduce((a, b) => a + b, 0) / notes.length
  const shift = Math.round((prevMeanMidi - mean) / 12) * 12
  return notes.map((n) => n + shift)
}
