import { RadioComposer } from '../music/radio/RadioComposer'
import type { RadioBanks } from '../music/radio/banks'
import type { RadioConfig } from '../music/radio/radioConfig'
import type { MusicalState } from '../music/radio/MusicalState'
import type { TrackDescriptor, BakedTrack } from '../trackDescriptor'

/** Minimal engine surface the controller needs — satisfied by the app's EngineApi. */
export interface RadioEngine {
  play(code: string): Promise<void>
  stop(): void
  setVolume(volume: number): void
  pause?(): Promise<void>    // TRUE pause via AudioContext.suspend() (optional — stubs/older engines may omit)
  resume?(): Promise<void>
}

export interface RadioControllerDeps {
  engine: RadioEngine
  banks: RadioBanks
  config: RadioConfig
  onState?: (state: MusicalState) => void
  /** Fired when the current track's arc completes and the loop auto-advances (drives favorites auto-next). */
  onTrackEnd?: () => void
  /** Gate: may the LIVE stream produce a NEW track now? false → stop after the current track. Defaults to always-true. */
  canGenerate?: () => boolean
  /** Fired once when a NEW live track begins (drives the trial generation counter). */
  onGenerated?: () => void
  /** Initial base volume (0..1); defaults to 0.8. */
  volume?: number
}

/** Section length in ms. setcpm(bpm/4) ⇒ 1 cycle = 1 bar ⇒ bar = 240000/bpm ms. */
export function sectionDurationMs(bpm: number, bars: number): number {
  return (bars * 240_000) / bpm
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

/** Seek by re-evaluating the SAME arrange program shifted left B bars: `.early(B)` makes bar B play at cycle 0
 *  (after the controller re-anchors). B === 0 is identity (replay from the start). */
export function appendEarly(program: string, bars: number): string {
  return bars <= 0 ? program : `${program.trimEnd()}.early(${bars})`
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
/** If the wall clock runs this far PAST our absolute grid (system sleep/resume, NTP step, a long-stalled
 *  thread), re-anchor instead of firing every overdue section back-to-back in a burst. */
const SCHED_REANCHOR_MS = 4000
/** Silent gap between tracks (bars): the old outro concludes & its tails ring out, a
 *  beat of silence, then the new track enters — instead of a fade-out/fade-in. */
// Silent bars between tracks — read from config so the composer (which advances its bar counter by the
// same amount to stay cycle-aligned across the gap) and the controller never disagree.

export class RadioController {
  private readonly engine: RadioEngine
  private readonly composer: RadioComposer
  private readonly config: RadioConfig
  private readonly onState?: (state: MusicalState) => void
  private readonly onTrackEnd?: () => void
  private readonly canGenerate?: () => boolean
  private readonly onGenerated?: () => void
  private lastGenIndex = -1 // last live-track index already counted (a new track is detected + counted once)
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private startMs = 0          // wall-clock at start(), for absolute scheduling
  private nextBoundaryMs = 0   // cumulative ms from start to the current section's end
  private epoch = 0            // bumped on every restart — lets tick()/tickBaked() bail if onTrackEnd re-entered
  private audibleIndex = 0     // the track index the listener currently HEARS (composer.currentIndex runs ahead)
  private audibleDesc: TrackDescriptor | null = null   // descriptor of the track being heard (the composer runs a whole track ahead after renderArrangedTrack)
  private audibleBars = 0      // total bars of the live track being heard (for saving)
  private pausedAt = 0         // wall-clock at pause() (to shift the absolute grid forward on resume)
  private pendingCb: (() => void) | null = null   // the scheduled boundary callback (re-armed on resume)
  private audibleProgram = ''      // the live track's current arrange program (replayed, shifted, on seek)
  private trackStartMs = 0         // wall-clock when the current track's audio began (for the progress readout)
  private playheadOffsetBars = 0   // bar the current playback started at (0 normally; B after a seek)
  private playBpm = 0              // current track tempo, so progress()/totalMs() know barMs
  // BAKED playback: a saved favorite plays its frozen section list (not the live composer).
  private baked: BakedTrack | null = null   // a loaded favorite = one self-contained arrange() program

  constructor(deps: RadioControllerDeps) {
    this.engine = deps.engine
    this.config = deps.config
    this.composer = new RadioComposer({ banks: deps.banks, config: deps.config })
    this.onState = deps.onState
    this.onTrackEnd = deps.onTrackEnd
    this.canGenerate = deps.canGenerate
    this.onGenerated = deps.onGenerated
    if (deps.volume !== undefined) this.engine.setVolume(deps.volume)
  }

  get isRunning(): boolean { return this.running }

  /** Compact identity of the track playing now (for saving to the library). */
  currentTrack(): TrackDescriptor { return this.audibleDesc ?? this.composer.descriptor() }   // the live track (a baked favorite has no descriptor; the App reads its state instead)

  // next/prev target relative to the AUDIBLE track, not composer.currentIndex() (which look-ahead-advances a
  // section early — so during the outro it sits a track ahead, making Next skip one and Prev replay the current).
  /** Skip to the next generated track. */
  next(): void { this.baked = null; this.composer.jumpTo(this.audibleIndex + 1); this.restartCurrent() }
  /** Back to the previous generated track (deterministic replay; floored at 0). */
  prev(): void { this.baked = null; this.composer.jumpTo(Math.max(0, this.audibleIndex - 1)); this.restartCurrent() }
  /** Leave BAKED (favorite) playback and resume the live generator from where it stands. No-op if already
   *  generating — used by the "Generation" mode toggle so a baked favorite doesn't loop forever. */
  resumeGenerative(): void { if (!this.baked) return; this.baked = null; this.restartCurrent() }
  /** Replay a specific track (e.g. an OLD favorite without a baked render) by seed+index (regenerates). */
  playTrack(seed: string, index: number): void { this.baked = null; this.composer.reseed(seed); this.composer.jumpTo(index); this.restartCurrent() }

  /** Total bars of the track AUDIBLY playing now (for the drag-to-save payload). */
  currentBars(): number { return this.baked ? this.baked.bars : this.audibleBars }

  /** Jump the CURRENT track (live or baked) to `frac` of its length. Re-evaluates the same arrange program shifted
   *  with .early(B); the swap quantises to the next bar. Seeking while paused resumes playback. No-op when idle. */
  seekToFraction(frac: number): void {
    if (!this.running) return
    const bars = this.currentBars()
    const program = this.baked ? this.baked.program : this.audibleProgram
    if (bars <= 0 || !program || this.playBpm <= 0) return
    const bpm = this.playBpm
    if (this.pausedAt) { void this.engine.resume?.(); this.pausedAt = 0 }   // a seek implies playing
    const B = Math.max(0, Math.min(bars - 1, Math.round(clamp01(frac) * bars)))
    this.epoch++
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }
    this.pendingCb = null
    this.anchorCycle()
    void this.engine.play(appendEarly(program, B))
    const now = Date.now()
    this.startMs = now; this.trackStartMs = now
    this.playheadOffsetBars = B
    this.nextBoundaryMs = sectionDurationMs(bpm, bars - B)
    const epoch = this.epoch
    this.arm(this.waitMs(), () => (this.baked ? this.onBakedBoundary(epoch, bpm) : this.onTrackBoundary(epoch, bpm)))
  }

  /** Current play position as a fraction 0..1 (0 when idle). Frozen while paused (uses pausedAt as the clock). */
  progress(): number {
    const bars = this.currentBars()
    if (!this.running || bars <= 0 || this.playBpm <= 0) return 0
    const clockNow = this.pausedAt || Date.now()
    const elapsedBars = (clockNow - this.trackStartMs) / sectionDurationMs(this.playBpm, 1)
    return clamp01((this.playheadOffsetBars + elapsedBars) / bars)
  }

  /** The current track's total duration in ms (0 when idle) — for the player's time label. */
  totalMs(): number {
    const bars = this.currentBars()
    return this.running && this.playBpm > 0 ? sectionDurationMs(this.playBpm, bars) : 0
  }

  /** Play a BAKED favorite: its frozen arrange() program loops on the grid (immune to generation changes). */
  playBaked(track: BakedTrack): void {
    this.baked = track
    this.restartCurrent()
  }

  /** Restart the loop on the freshly-selected track (no auto-advance event for a manual switch). */
  private restartCurrent(): void {
    this.epoch++   // invalidate any tick()/tickBaked() that is mid-flight (e.g. the one whose onTrackEnd re-entered here)
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }
    this.lastGenIndex = -1       // the freshly-selected (🎲/next/start) track counts as a NEW generation
    this.pendingCb = null; this.pausedAt = 0
    this.anchorCycle()
    this.startMs = Date.now()
    this.nextBoundaryMs = 0
    this.audibleDesc = null   // not playing yet → currentTrack() falls back to the composer's (jumped-to) descriptor
    this.audibleIndex = this.composer.currentIndex()   // nothing playing yet → the jumped-to track IS the audible one
    if (this.running) this.tick()
  }

  /** Re-anchor Strudel's cycle clock to OUR grid. The prelude (evaluated at init) ends in `silence`, so the
   *  cyclist runs continuously from warmup — by the time the radio actually starts it sits at an arbitrary,
   *  non-integer cycle, which offsets every section boundary from Strudel's integer-cycle swap grid and lets
   *  parts cut each other mid-bar. hush() stops the cyclist; the next section's evaluate restarts it from cycle
   *  0, lined up with startMs and the composer's bar 0 → swaps land exactly on section boundaries. */
  private anchorCycle(): void { this.engine.stop() }

  /** Set the master volume on the engine. */
  setVolume(volume: number): void {
    this.engine.setVolume(volume)
  }

  /** TRUE pause / resume: freeze the audio clock (suspend) AND the auto-advance timer, and continue from the exact
   *  same position. On resume the absolute grid is shifted forward by the paused duration so the schedule stays aligned. */
  async pause(): Promise<void> {
    if (!this.running) return   // nothing playing to freeze (already stopped) — a no-op keeps the engine state clean
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }   // also freeze the wall-clock advance, not just audio
    if (!this.pausedAt) this.pausedAt = Date.now()
    await this.engine.pause?.()
  }
  async resume(): Promise<void> {
    if (!this.running) { this.start(); return }   // nothing was suspended (e.g. resuming after a hard stop) → start fresh
    await this.engine.resume?.()
    if (this.pausedAt) { const d = Date.now() - this.pausedAt; this.startMs += d; this.trackStartMs += d; this.pausedAt = 0 }
    if (this.pendingCb && this.timer === null) this.arm(this.waitMs(), this.pendingCb)
  }

  /** Schedule the next boundary callback, remembering it so pause()/resume() can re-arm it. */
  private arm(delayMs: number, cb: () => void): void {
    this.pendingCb = cb
    this.timer = setTimeout(() => { this.pendingCb = null; cb() }, delayMs)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.anchorCycle()   // re-anchor Strudel's cycle to our grid (see anchorCycle) so swaps land on boundaries
    this.startMs = Date.now()
    this.nextBoundaryMs = 0
    this.tick()
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }
    this.engine.stop()
  }

  /** ms to wait until SWAP_LEAD_MS before the next boundary on the absolute grid. If the wall clock has jumped
   *  far past the grid (sleep/resume, NTP step), re-anchor startMs so we don't burst-fire every overdue section. */
  private waitMs(): number {
    if (Date.now() - this.startMs > this.nextBoundaryMs + SCHED_REANCHOR_MS) this.startMs = Date.now() - this.nextBoundaryMs
    return Math.max(0, this.nextBoundaryMs - (Date.now() - this.startMs) - SWAP_LEAD_MS)
  }

  private tick(): void {
    if (!this.running) return
    if (this.baked) { this.tickBaked(); return }
    // A NEW live track is about to be produced — gate on the trial-generation limit first.
    if (this.canGenerate && !this.canGenerate()) { this.stopNow(); return }
    const desc = this.composer.descriptor()                          // the track we're about to render (the audible one)
    const { program, totalBars, bpm } = this.composer.renderArrangedTrack()   // ONE arrange() program; advances the composer to the next track
    this.audibleDesc = desc
    this.audibleIndex = desc.index
    this.audibleBars = totalBars
    this.audibleProgram = program
    this.trackStartMs = Date.now(); this.playheadOffsetBars = 0; this.playBpm = bpm
    if (desc.index !== this.lastGenIndex) { this.lastGenIndex = desc.index; this.onGenerated?.() }
    this.onState?.(this.trackState(desc, bpm, program))
    void this.engine.play(program)
    // Absolute, self-correcting schedule: play the WHOLE track out (totalBars), then the boundary handler.
    this.nextBoundaryMs += sectionDurationMs(bpm, totalBars)
    const epoch = this.epoch
    this.arm(this.waitMs(), () => this.onTrackBoundary(epoch, bpm))
  }

  /** End of a live track: a short silent gap (so reverb/delay tails ring out), fire onTrackEnd (favorites auto-next
   *  may synchronously re-enter — the epoch guard bails then), then generate + play the next track. */
  private onTrackBoundary(epoch: number, bpm: number): void {
    if (this.epoch !== epoch || !this.running) return
    void this.engine.play('silence')
    this.onTrackEnd?.()
    if (this.epoch !== epoch || !this.running) return
    this.nextBoundaryMs += sectionDurationMs(bpm, this.config.trackGapBars)
    this.arm(this.waitMs(), () => this.tick())
  }

  private stopNow(): void {
    this.running = false
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }
    this.pendingCb = null
  }

  /** Whole-track MusicalState for the HUD — identity from the descriptor + the full arrange program for the code
   *  panel (per-section detail isn't tracked under arrange). `name` is left UNSET so the UI derives it via
   *  radioTrackName(); setting '' would defeat that `?? radioTrackName` fallback. */
  private trackState(desc: TrackDescriptor, bpm: number, program: string): MusicalState {
    return {
      seed: desc.seed, trackIndex: desc.index, trackSeed: `${desc.seed}:t${desc.index}`,
      strudelCode: program, mood: desc.mood, sectionsUntilMoodChange: 0,
      key: desc.key, scaleName: desc.scaleName, chord: '', section: '',
      sectionBars: 0, bpm, bar: 0,
      layers: { kicks: true, bass: true, lead: true, bg: true, perc: true },
    }
  }

  /** BAKED playback: a favorite plays its frozen arrange() program, looping on the grid. */
  private tickBaked(): void {
    if (!this.running || !this.baked) return
    const b = this.baked
    this.trackStartMs = Date.now(); this.playheadOffsetBars = 0; this.playBpm = b.bpm
    this.onState?.(this.bakedState(b))
    void this.engine.play(b.program)
    this.nextBoundaryMs += sectionDurationMs(b.bpm, b.bars)
    const epoch = this.epoch
    this.arm(this.waitMs(), () => this.onBakedBoundary(epoch, b.bpm))
  }

  /** End of a baked track: a silent gap, onTrackEnd (the favorites queue may switch us), else loop THIS favorite. */
  private onBakedBoundary(epoch: number, bpm: number): void {
    if (this.epoch !== epoch || !this.running || !this.baked) return
    const before = this.baked
    void this.engine.play('silence')
    this.onTrackEnd?.()
    if (this.baked !== before || this.epoch !== epoch || !this.running) return   // switched to another favorite
    this.nextBoundaryMs += sectionDurationMs(bpm, this.config.trackGapBars)
    this.arm(this.waitMs(), () => this.tickBaked())
  }

  /** Whole-track MusicalState for a baked favorite — its FROZEN name + the arrange program for the code panel. */
  private bakedState(b: BakedTrack): MusicalState {
    return {
      seed: '', trackIndex: 0, trackSeed: '',
      strudelCode: b.program, mood: b.info.mood, sectionsUntilMoodChange: 0,
      key: b.info.key, scaleName: b.info.scale, chord: '', section: '',
      sectionBars: 0, bpm: b.bpm, bar: 0,
      layers: { kicks: true, bass: true, lead: true, bg: true, perc: true }, name: b.name,
    }
  }
}
