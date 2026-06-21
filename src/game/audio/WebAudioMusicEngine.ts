import type { StemLibrary, Arrangement, IMusicEngine } from './types'
import { ANALYSER_FFT, analyserLevel, fillBands } from './AudioAnalysis'

const LOOP_SECONDS = 8.0          // musical loop length (NOT the 8.0065 file length — that's Opus padding)
const SCHEDULE_AHEAD_SEC = 2.0    // how far ahead we schedule sources. With margin: the loop is long (8s) and
                                  // scheduled once every 8s, so a main-thread stall (heavy frame, GC,
                                  // setInterval throttling in an inactive tab) longer than the scheduling
                                  // window drops a whole loop into silence. 2s survives normal hitches without a gap.
const SCHEDULER_TICK_MS = 50      // scheduler tick period
const START_DELAY_SEC = 0.12      // offset of the first loop from currentTime (for decode/scheduling)
const CROSSFADE_SEC = 0.12        // crossfade length on stem swap: the outgoing "tail" and the incoming
                                  // voice overlap past the boundary (smooths the bass→bass, kick→kick seam)
const START_FADE_SEC = 0.5        // soft fade-in of all music on start (entering the fight)
const END_FADE_SEC = 0.8          // fade-out of the dry signal at match end
const MASTER_GAIN_DEFAULT = 0.6
// Decaying echo at match end: silent during play, turns on at fadeOut and rings out with a tail,
// so the track doesn't cut off abruptly. delay→feedback→delay (decay loop), input gated by echoSend.
const ECHO_DELAY_SEC = 0.35       // echo delay time (between repeats)
const ECHO_FEEDBACK = 0.5         // feedback coefficient (<1): each repeat quieter, tail ~2s
const ECHO_WET = 0.45             // echo output volume
// Stem loudness normalization: bring each stem to a target RMS (quiet leads are audible, loud kicks
// don't stand out), but cap the multiplier so the PEAK stays under the ceiling (kick transients
// don't hurt the ears). Computed from decoded PCM → deterministic and identical across peers.
const NORM_TARGET_RMS = 0.10
const NORM_MIN_GAIN = 0.25
const NORM_MAX_GAIN = 4.0
const NORM_PEAK_CEILING = 0.9
const FADE_CURVE_POINTS = 32      // points in the equal-power crossfade curve
const DECLICK_SEC = 0.003         // micro-fade from/to zero at each source's edges. Stem buffers
                                  // start/end on a NON-zero sample (especially bass: buffer[0]≈+0.08,
                                  // buffer[end]≈-0.16) → start/cut at full gain = signal discontinuity = click.

/** 'none' — gain holds flat (with de-click edges); 'in'/'out' — equal-power crossfade up/down. */
type Fade = 'none' | 'in' | 'out'

/** Equal-power crossfade curve: 'in' = gain·sin, 'out' = gain·cos (1/4 period).
 *  The summed power of the out+in pair stays constant → transition with no loudness dip.
 *  Both curves start at zero (for 'out' forced c[0]=0) — a fresh source must not
 *  begin sound at a non-zero buffer[0] on full gain, otherwise a click. */
export function equalPowerCurve(gain: number, fade: 'in' | 'out'): Float32Array {
  const curve = new Float32Array(FADE_CURVE_POINTS)
  for (let i = 0; i < FADE_CURVE_POINTS; i++) {
    const t = (i / (FADE_CURVE_POINTS - 1)) * (Math.PI / 2)
    curve[i] = gain * (fade === 'in' ? Math.sin(t) : Math.cos(t))
  }
  if (fade === 'out') curve[0] = 0   // de-click: the tail starts from zero, not from full at buffer[0]
  return curve
}

/** Stem loudness normalization multiplier: toward target RMS, capped by peak (anti-"hurts the ears"). */
export function normGainFor(rms: number, peak: number): number {
  if (rms <= 0) return 1
  let g = Math.min(NORM_MAX_GAIN, Math.max(NORM_MIN_GAIN, NORM_TARGET_RMS / rms))
  if (peak > 0 && peak * g > NORM_PEAK_CEILING) g = NORM_PEAK_CEILING / peak   // peak-safe outranks the RMS target
  return g
}

/** RMS and peak of a buffer across all channels (for loudness normalization). */
function analyzeLoudness(buf: AudioBuffer): { rms: number; peak: number } {
  let sumSq = 0, peak = 0, count = 0
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < d.length; i++) {
      const x = d[i]
      sumSq += x * x
      const a = x < 0 ? -x : x
      if (a > peak) peak = a
    }
    count += d.length
  }
  return { rms: count > 0 ? Math.sqrt(sumSq / count) : 0, peak }
}

/** Web Audio engine: stem decode, lookahead scheduler, sample-accurate looping + crossfade. */
export class WebAudioMusicEngine implements IMusicEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private echoSend: GainNode | null = null   // echo input gate: 0 during play, opens on fadeOut
  private buffers = new Map<string, AudioBuffer>()
  private norm = new Map<string, number>()   // stemId → loudness normalization multiplier
  private provider: ((loopIndex: number) => Arrangement) | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextBoundary = 0
  private _loopIndex = 0
  private prevVoices = new Map<string, number>()   // stemId of playing voices → their gain (for swap crossfade)
  private _active = new Set<string>()
  private userGain = 1   // user music level 0..1 (on top of the MASTER_GAIN_DEFAULT reference)
  private analyser: AnalyserNode | null = null   // master tap for visualization
  private analyserBuf = new Uint8Array(new ArrayBuffer(ANALYSER_FFT))
  private freqBuf = new Uint8Array(new ArrayBuffer(ANALYSER_FFT / 2))

  /** Current music RMS level 0..1 (for visualization). */
  readLevel(): number { return this.analyser ? analyserLevel(this.analyser, this.analyserBuf) : 0 }
  /** Music spectrum into out[] (max-combining). */
  readBands(out: Float32Array): void { if (this.analyser) fillBands(this.analyser, this.freqBuf, out) }

  get loopIndex(): number { return Math.max(0, this._loopIndex - 1) }
  activeStemIds(): string[] { return [...this._active] }

  async load(library: StemLibrary): Promise<void> {
    const ctx = this.ensureCtx()
    const refs = Object.values(library).flat()
    await Promise.all(refs.map(async ref => {
      if (this.buffers.has(ref.id)) return
      const data = await (await fetch(ref.url)).arrayBuffer()
      const buf = await ctx.decodeAudioData(data)
      this.buffers.set(ref.id, buf)
      const { rms, peak } = analyzeLoudness(buf)
      this.norm.set(ref.id, normGainFor(rms, peak))
    }))
  }

  async start(provider: (loopIndex: number) => Arrangement, fadeInSec: number = START_FADE_SEC): Promise<void> {
    const ctx = this.ensureCtx()
    this.provider = provider
    if (ctx.state === 'suspended') await ctx.resume()
    this._loopIndex = 0
    this.prevVoices.clear()
    const now = ctx.currentTime
    // Echo reset: on engine reuse (menu music) a prior fadeOut left echoSend open —
    // otherwise echo bleeds in and accumulates after returning. Close it before a new start.
    if (this.echoSend) { this.echoSend.gain.cancelScheduledValues(now); this.echoSend.gain.setValueAtTime(0, now) }
    // Soft fade-in of all music: master from 0 to working volume × user level over fadeInSec.
    this.master!.gain.cancelScheduledValues(now)
    this.master!.gain.setValueAtTime(0, now)
    this.master!.gain.linearRampToValueAtTime(MASTER_GAIN_DEFAULT * this.userGain, now + fadeInSec)
    this.nextBoundary = now + START_DELAY_SEC
    if (this.timer == null) this.timer = setInterval(() => this.tick(), SCHEDULER_TICK_MS)
    this.tick()
  }

  fadeOut(): void {
    const ctx = this.ctx
    if (ctx && this.master) {
      const now = ctx.currentTime
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setValueAtTime(this.master.gain.value, now)
      this.master.gain.linearRampToValueAtTime(0, now + END_FADE_SEC)
      // Open echo: the fading dry signal feeds the delay and rings out ~2s (not an abrupt cut).
      if (this.echoSend) {
        this.echoSend.gain.cancelScheduledValues(now)
        this.echoSend.gain.setValueAtTime(0, now)
        this.echoSend.gain.linearRampToValueAtTime(1, now + 0.05)
      }
    }
    // Kill the scheduler at once: already-playing loops finish under the fading master, no new ones needed.
    if (this.timer != null) { clearInterval(this.timer); this.timer = null }
  }

  stop(): void {
    if (this.timer != null) { clearInterval(this.timer); this.timer = null }
    this._active.clear()
    this.prevVoices.clear()
  }

  /** User music level 0..1 (1 = the MASTER_GAIN_DEFAULT reference). Applied live and on start. */
  setMasterGain(gain: number): void {
    this.userGain = Math.min(1, Math.max(0, gain))
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(MASTER_GAIN_DEFAULT * this.userGain, this.ctx.currentTime, 0.05)
  }

  dispose(): void {
    this.stop()
    void this.ctx?.close().catch(() => {})
    this.ctx = null
    this.master = null
    this.echoSend = null
    this.analyser = null
    this.buffers.clear()
    this.norm.clear()
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = MASTER_GAIN_DEFAULT
      this.master.connect(this.ctx.destination)                         // dry signal
      this.analyser = this.ctx.createAnalyser()                         // tap for visualization (doesn't affect sound)
      this.analyser.fftSize = ANALYSER_FFT
      this.master.connect(this.analyser)
      // Echo bus: master → echoSend(0) → delay → feedback↺ → echoWet → destination.
      // echoSend closed during play (echo doesn't accumulate); opens on fadeOut.
      this.echoSend = this.ctx.createGain()
      this.echoSend.gain.value = 0
      const delay = this.ctx.createDelay(1.0)
      delay.delayTime.value = ECHO_DELAY_SEC
      const feedback = this.ctx.createGain()
      feedback.gain.value = ECHO_FEEDBACK
      const echoWet = this.ctx.createGain()
      echoWet.gain.value = ECHO_WET
      this.master.connect(this.echoSend).connect(delay)
      delay.connect(feedback).connect(delay)                            // feedback loop (decay)
      delay.connect(echoWet).connect(this.ctx.destination)
    }
    return this.ctx
  }

  private tick(): void {
    const ctx = this.ctx
    const provider = this.provider
    if (!ctx || !provider || !this.master) return
    // Scheduler fell behind (setInterval throttling in a background tab while currentTime keeps going):
    // do NOT dump overdue loops at once — otherwise src.start(when<now) starts them immediately, all
    // together → overlap/mush (grows with each backgrounding). Jump forward to the present time.
    if (this.nextBoundary < ctx.currentTime) {
      const missed = Math.ceil((ctx.currentTime - this.nextBoundary) / LOOP_SECONDS)
      this.nextBoundary += missed * LOOP_SECONDS
      this._loopIndex += missed
    }
    while (this.nextBoundary < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this.scheduleLoop(this._loopIndex, this.nextBoundary, provider)
      this.nextBoundary += LOOP_SECONDS
      this._loopIndex++
    }
  }

  private scheduleLoop(loopIndex: number, when: number, provider: (i: number) => Arrangement): void {
    const arr = provider(loopIndex)
    const ids = new Set(arr.map(v => v.stemId))

    // Outgoing voices (present last loop, gone now): play out a short "tail" of the same
    // stem from its start — the tail's downbeat matches the boundary and butts up against the stopped
    // source, so the stem keeps sounding for another CROSSFADE_SEC and fades. This tail overlaps
    // with the incoming voice's fade-in → an honest crossfade with no drop into silence.
    for (const [id, prevGain] of this.prevVoices) {
      if (ids.has(id)) continue
      this.scheduleSource(id, when, prevGain, 'out', CROSSFADE_SEC)   // outgoing tail — equal-power down
    }

    const voices = new Map<string, number>()
    for (const v of arr) {
      const fade: Fade = this.prevVoices.has(v.stemId) ? 'none' : 'in'  // continues butt-jointed / enters with a crossfade
      this.scheduleSource(v.stemId, when, v.gain, fade, LOOP_SECONDS)
      if (this.buffers.has(v.stemId)) voices.set(v.stemId, v.gain)
    }
    this.prevVoices = voices
    this._active = ids
  }

  /** One stem source: start `when`, length `dur`. Gain always rises from zero and falls to zero
   *  (de-click edges), otherwise a start/cut on a non-zero buffer sample produces a click:
   *   - 'in'   — equal-power rise over CROSSFADE_SEC, then holds, with a de-click fall at the end;
   *   - 'out'  — tail: equal-power fall over CROSSFADE_SEC (curve starts at zero → no click on start);
   *   - 'none' — continuation: micro-fade from zero in and to zero out (no CROSSFADE needed — butt joint). */
  private scheduleSource(stemId: string, when: number, gain: number, fade: Fade, dur: number): void {
    const buf = this.buffers.get(stemId)
    if (!buf || !this.ctx || !this.master) return
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const ng = gain * (this.norm.get(stemId) ?? 1)   // role volume × stem normalization
    const g = this.ctx.createGain()
    const p = g.gain
    const end = when + dur
    if (fade === 'out') {
      p.setValueCurveAtTime(equalPowerCurve(ng, 'out'), when, CROSSFADE_SEC)   // fall to 0, start at 0
    } else {
      if (fade === 'in') p.setValueCurveAtTime(equalPowerCurve(ng, 'in'), when, CROSSFADE_SEC)
      else { p.setValueAtTime(0, when); p.linearRampToValueAtTime(ng, when + DECLICK_SEC) }  // 'none' — de-click in
      p.setValueAtTime(ng, end - DECLICK_SEC)   // de-click out at loop end (stem doesn't end on zero)
      p.linearRampToValueAtTime(0, end)
    }
    src.connect(g).connect(this.master)
    src.start(when)
    src.stop(end)
  }
}
