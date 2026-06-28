// The reactive snapshot the composer emits alongside each pattern. Pure data.

export type SectionName = 'intro' | 'A' | 'A_prime' | 'break' | 'B'

export interface LayerFlags {
  kicks: boolean; bass: boolean; lead: boolean; bg: boolean; perc: boolean
}

export interface MusicalState {
  seed: string
  /** Index of the current track within the session. */
  trackIndex: number
  /** Reproducible per-track seed (`${seed}:t${trackIndex}`). */
  trackSeed: string
  /** The full Strudel program currently playing (for the on-screen code panel). */
  strudelCode: string
  mood: string
  /** Sections remaining before the next mood rotation. */
  sectionsUntilMoodChange: number
  key: string        // e.g. "E"
  scaleName: string  // e.g. "phrygian"
  chord: string      // current chord label, e.g. "Em7"
  section: string    // arrangement role, e.g. "drop" / "breakdown"
  /** Length of the current section in bars (varies by role; riser is short). */
  sectionBars: number
  bpm: number
  bar: number        // absolute bar counter since session start
  layers: LayerFlags
  /** Set only when replaying a BAKED favorite: its frozen name (so the UI shows the saved name,
   *  not a re-derived one that could drift if the naming algorithm changes). */
  name?: string
}
