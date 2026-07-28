import type { IMusicEngine, StemLibrary, Arrangement, StemRef } from './types'
import { STEM_LIBRARY } from './stems'

/**
 * Trailer music: DETERMINISTIC (fixed, reproducible) arrangement, no randomness and no
 * fade-in (enters at full strength at once — after the countdown). Progression by loop:
 *   loop 0 — kicks + bass
 *   loop 1 — + lead 1
 *   loop 2 and on — + lead 2
 * Stems are the same as in the menu (same sound palette).
 */
const KICK_ID = 'kicks/sub_long'
const BASS_ID = 'bass/kutting'
const LEAD1_ID = 'lead/crickets_tex'
const LEAD2_ID = 'lead/lwt_14'
const KICK_GAIN = 1.25
const BASS_GAIN = 0.9
const LEAD_GAIN = 0.5

function trailerLibrary(): StemLibrary {
  const all: StemRef[] = Object.values(STEM_LIBRARY).flat()
  const pick = (id: string) => all.filter(s => s.id === id)
  return {
    kicks: pick(KICK_ID),
    bass: pick(BASS_ID),
    lead: [...pick(LEAD1_ID), ...pick(LEAD2_ID)],
    sfx: [],
  }
}

export class TrailerMusic {
  private readonly engine: IMusicEngine
  private readonly lib: StemLibrary
  private started = false

  constructor(engine: IMusicEngine) {
    this.engine = engine
    this.lib = trailerLibrary()
  }

  async preload(): Promise<void> { await this.engine.load(this.lib) }

  /** Start without fade-in — straight to full (call on "go" after the countdown, from a gesture). */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.engine.load(this.lib)
    await this.engine.start(i => this.arrange(i), 0)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.engine.fadeOut()
  }

  setVolume(v: number): void { this.engine.setMasterGain(v) }
  dispose(): void { this.engine.dispose() }

  /** Deterministic progression: kicks+bass → +lead1 → +lead2 (and on to the end). */
  arrange(loopIndex: number): Arrangement {
    const voices: Arrangement = [
      { role: 'kicks', stemId: KICK_ID, gain: KICK_GAIN },
      { role: 'bass', stemId: BASS_ID, gain: BASS_GAIN },
    ]
    if (loopIndex >= 1) voices.push({ role: 'lead', stemId: LEAD1_ID, gain: LEAD_GAIN })
    if (loopIndex >= 2) voices.push({ role: 'lead', stemId: LEAD2_ID, gain: LEAD_GAIN })
    return voices
  }
}
