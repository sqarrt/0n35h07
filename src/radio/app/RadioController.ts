import { RadioComposer } from '../music/radio/RadioComposer'
import type { RadioBanks } from '../music/radio/banks'
import type { RadioConfig } from '../music/radio/radioConfig'
import type { MusicalState } from '../music/radio/MusicalState'
import type { TrackDescriptor, BakedSection, BakedTrack } from '../trackDescriptor'
import type { BiasProvider } from '../bias'

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
  /** Fired when the current track's arc completes and the loop auto-advances (drives favorites auto-next). */
  onTrackEnd?: () => void
  /** Bias generation by the player's likes/dislikes (mood/key/scale). */
  bias?: BiasProvider
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
  private readonly banks: RadioBanks
  private readonly config: RadioConfig
  private readonly bias?: BiasProvider
  private readonly bars: number
  private readonly onState?: (state: MusicalState) => void
  private readonly onTrackEnd?: () => void
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private prevTrackIndex: number | null = null
  private startMs = 0          // wall-clock at start(), for absolute scheduling
  private nextBoundaryMs = 0   // cumulative ms from start to the current section's end
  // BAKED playback: a saved favorite plays its frozen section list (not the live composer).
  private baked: { desc: TrackDescriptor; track: BakedTrack } | null = null
  private bakedPos = 0

  constructor(deps: RadioControllerDeps) {
    this.engine = deps.engine
    this.banks = deps.banks
    this.config = deps.config
    this.bias = deps.bias
    this.composer = new RadioComposer({ banks: deps.banks, config: deps.config, bias: deps.bias })
    this.bars = deps.config.sectionLengthBars
    this.onState = deps.onState
    this.onTrackEnd = deps.onTrackEnd
    if (deps.volume !== undefined) this.engine.setVolume(deps.volume)
  }

  get isRunning(): boolean { return this.running }

  /** Compact identity of the track playing now (for like/dislike + favorites). */
  currentTrack(): TrackDescriptor { return this.baked ? this.baked.desc : this.composer.descriptor() }

  /** Skip to the next generated track. */
  next(): void { this.baked = null; this.composer.jumpTo(this.composer.currentIndex() + 1); this.restartCurrent() }
  /** Back to the previous generated track (deterministic replay; floored at 0). */
  prev(): void { this.baked = null; this.composer.jumpTo(Math.max(0, this.composer.currentIndex() - 1)); this.restartCurrent() }
  /** Replay a specific track (e.g. an OLD favorite without a baked render) by seed+index (regenerates). */
  playTrack(seed: string, index: number): void { this.baked = null; this.composer.reseed(seed); this.composer.jumpTo(index); this.restartCurrent() }

  /** Render the FULL arc of a track to a frozen section list — for "baking" a favorite at save time.
   *  Uses a throwaway composer so live playback is untouched; deterministic from seed+index. */
  bake(seed: string, index: number): BakedSection[] {
    const tmp = new RadioComposer({ banks: this.banks, config: this.config, bias: this.bias })
    tmp.reseed(seed)
    tmp.jumpTo(index)
    return tmp.renderTrack()
  }

  /** Play a BAKED favorite: its frozen sections loop in order (immune to generation changes). */
  playBaked(desc: TrackDescriptor, track: BakedTrack): void {
    this.baked = { desc, track }
    this.bakedPos = 0
    this.restartCurrent()
  }

  /** Restart the loop on the freshly-selected track (no auto-advance event for a manual switch). */
  private restartCurrent(): void {
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }
    this.prevTrackIndex = null   // suppress the onTrackEnd that tick() fires on an auto-advance
    this.startMs = Date.now()
    this.nextBoundaryMs = 0
    if (this.running) this.tick()
  }

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
    if (this.baked) { this.tickBaked(); return }
    const { strudelCode, musicalState } = this.composer.buildNextPattern()
    const isNewTrack = this.prevTrackIndex !== null && musicalState.trackIndex !== this.prevTrackIndex
    this.prevTrackIndex = musicalState.trackIndex
    if (isNewTrack) this.onTrackEnd?.()   // the previous track's arc completed (auto-advance)

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

  /** BAKED playback: walk the frozen section list on the same absolute grid as the generative loop. */
  private tickBaked(): void {
    if (!this.running || !this.baked) return
    const { desc, track } = this.baked
    if (this.bakedPos >= track.sections.length) {
      // The baked arc completed → auto-advance (favorites). If the App switches to another favorite
      // it restarts the loop itself; otherwise we loop THIS baked track after a short silent gap.
      this.bakedPos = 0
      const before = this.baked
      this.onTrackEnd?.()
      if (this.baked !== before) return
      void this.engine.play('silence')
      this.nextBoundaryMs += sectionDurationMs(desc.bpm, TRACK_GAP_BARS)
      this.timer = setTimeout(() => this.tickBaked(), Math.max(0, this.nextBoundaryMs - (Date.now() - this.startMs) - SWAP_LEAD_MS))
      return
    }
    const sec = track.sections[this.bakedPos++]
    this.onState?.(this.bakedState(desc, track, sec))
    void this.engine.play(sec.code)
    this.nextBoundaryMs += sectionDurationMs(desc.bpm, sec.bars || this.bars)
    this.timer = setTimeout(() => this.tickBaked(), Math.max(0, this.nextBoundaryMs - (Date.now() - this.startMs) - SWAP_LEAD_MS))
  }

  /** Minimal MusicalState for a baked section — identity from the descriptor, code/bars from the section,
   *  and the FROZEN baked name so the UI shows the saved name (not a re-derived one). */
  private bakedState(desc: TrackDescriptor, track: BakedTrack, sec: BakedSection): MusicalState {
    return {
      seed: desc.seed, trackIndex: desc.index, trackSeed: `${desc.seed}:t${desc.index}`,
      strudelCode: sec.code, mood: desc.mood, sectionsUntilMoodChange: 0,
      key: desc.key, scaleName: desc.scaleName, chord: '', section: '',
      sectionBars: sec.bars, bpm: desc.bpm, bar: 0,
      layers: { kicks: true, bass: true, lead: false, bg: true, perc: true }, name: track.name,
    }
  }
}
