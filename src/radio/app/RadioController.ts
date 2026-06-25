import { RadioComposer } from '../music/radio/RadioComposer'
import type { RadioBanks } from '../music/radio/banks'
import type { RadioConfig } from '../music/radio/radioConfig'
import type { MusicalState } from '../music/radio/MusicalState'

/** Minimal engine surface the controller needs — satisfied by the app's EngineApi. */
export interface RadioEngine {
  play(code: string): Promise<void>
  stop(): void
  setVolume(volume: number): void
}

export interface RadioControllerDeps {
  engine: RadioEngine
  banks: RadioBanks
  config: RadioConfig
  onState?: (state: MusicalState) => void
  /** Initial base volume (0..1); defaults to 0.8. */
  volume?: number
}

/** Section length in ms. setcpm(bpm/4) ⇒ 1 cycle = 1 bar ⇒ bar = 240000/bpm ms. */
export function sectionDurationMs(bpm: number, bars: number): number {
  return (bars * 240_000) / bpm
}

/**
 * Drives the pure RadioComposer in a continuous loop: build a section, play it
 * (Strudel quantizes the swap to the next cycle), then schedule the next section
 * one section-length later. No sample-accurate queue — the build is synchronous
 * and instant, so the code is ready before each boundary.
 */
/**
 * How far BEFORE a section boundary we trigger the next `evaluate()`. Strudel
 * quantizes the swap to the next cycle, so calling it inside the last bar lands the
 * swap exactly on the bar grid — this is what keeps parts from being cut mid-phrase
 * or entering off-beat. Must be < one bar (≈1.6 s+ here) and > engine eval latency.
 */
const SWAP_LEAD_MS = 150
/** Silent gap between tracks (bars): the old outro concludes & its tails ring out, a
 *  beat of silence, then the new track enters — instead of a fade-out/fade-in. */
const TRACK_GAP_BARS = 2

export class RadioController {
  private readonly engine: RadioEngine
  private readonly composer: RadioComposer
  private readonly bars: number
  private readonly onState?: (state: MusicalState) => void
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private prevTrackIndex: number | null = null
  private startMs = 0          // wall-clock at start(), for absolute scheduling
  private nextBoundaryMs = 0   // cumulative ms from start to the current section's end

  constructor(deps: RadioControllerDeps) {
    this.engine = deps.engine
    this.composer = new RadioComposer({ banks: deps.banks, config: deps.config })
    this.bars = deps.config.sectionLengthBars
    this.onState = deps.onState
    if (deps.volume !== undefined) this.engine.setVolume(deps.volume)
  }

  get isRunning(): boolean { return this.running }

  /** Set the master volume on the engine. */
  setVolume(volume: number): void {
    this.engine.setVolume(volume)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.startMs = Date.now()
    this.nextBoundaryMs = 0
    this.tick()
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }
    this.engine.stop()
  }

  private tick(): void {
    if (!this.running) return
    const { strudelCode, musicalState } = this.composer.buildNextPattern()
    const isNewTrack = this.prevTrackIndex !== null && musicalState.trackIndex !== this.prevTrackIndex
    this.prevTrackIndex = musicalState.trackIndex

    // NEW TRACK: no fade. The previous outro has played out; switch to silence so its
    // reverb/delay tails ring into a short gap, then start the new track on the grid.
    if (isNewTrack) {
      void this.engine.play('silence')
      this.nextBoundaryMs += sectionDurationMs(musicalState.bpm, TRACK_GAP_BARS)
      const waitGap = Math.max(0, this.nextBoundaryMs - (Date.now() - this.startMs) - SWAP_LEAD_MS)
      this.timer = setTimeout(() => this.playSection(strudelCode, musicalState), waitGap)
      return
    }
    this.playSection(strudelCode, musicalState)
  }

  /** Emit a section's state + audio, then schedule the next tick on the absolute grid. */
  private playSection(strudelCode: string, musicalState: MusicalState): void {
    if (!this.running) return
    this.onState?.(musicalState)
    void this.engine.play(strudelCode)
    // Absolute, self-correcting schedule: advance the cumulative boundary by this
    // section's exact length, then wait until SWAP_LEAD_MS before that absolute time.
    // Timer jitter can't accumulate (we target an absolute grid), and the early
    // trigger lets Strudel quantize each swap onto the bar boundary.
    const dur = sectionDurationMs(musicalState.bpm, musicalState.sectionBars || this.bars)
    this.nextBoundaryMs += dur
    const wait = Math.max(0, this.nextBoundaryMs - (Date.now() - this.startMs) - SWAP_LEAD_MS)
    this.timer = setTimeout(() => this.tick(), wait)
  }
}
