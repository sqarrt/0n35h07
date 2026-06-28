import {
  initStrudel,
  initAudio,
  evaluate,
  hush,
  samples,
  getAudioContext,
  getSuperdoughAudioController,
} from '@strudel/web'
import type { IStrudelEngine } from './IStrudelEngine'
import { PRELUDE_CODE } from './prelude'
import { BEATS_PER_CYCLE, FIXED_BPM } from './stemContract'
import { encodeWav } from './wavEncoder'

const DEFAULT_VOLUME = 0.8
const DIRT_SAMPLES = 'github:tidalcycles/dirt-samples'
// strudel.cc's default sound packs (curated manifests): drum machines (banks),
// piano, a Dirt subset, EmuSP12 (default drum hits incl. oh/rim), orchestral
// (vcsl), and mridangam. Wavetables (wt_*) come from Dough-Waveforms (wt_flute,
// wt_violin, ...) plus uzu-wavetables — the wt_digital_* set strudel.cc now ships
// by default (wt_digital / _basique / _echoes / _bad_day / _crickets / _curses).
const DOUGH = 'https://raw.githubusercontent.com/felixroos/dough-samples/main/'
const WAVEFORMS = 'github:Bubobubobubobubo/Dough-Waveforms'
const UZU_WAVETABLES = 'https://strudel.b-cdn.net/uzu-wavetables.json'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// Output metering for the visualizer (level + spectrum). A small analyser window is enough for
// time-domain RMS. Math mirrors the game's AudioAnalysis, inlined to keep the radio subtree
// self-contained (no radio→game import).
const ANALYSER_FFT = 1024   // larger window → finer low-frequency bins (the visualizer's kick/beat detection)
const BYTE_MID = 128   // midpoint of the byte time-domain signal (silence)
// The analyser taps the master AFTER the volume gain, so a quiet slider would starve the visualizer. The visualizer
// must behave the SAME at any volume → normalise readings to a fixed reference level (≈ a comfortable mid-low volume),
// capping the boost so a near-zero slider doesn't amplify the noise floor.
const VIS_REF_LEVEL = 0.06
const VIS_MAX_GAIN = 5
const VIS_MIN_VOLUME = 0.03
/** RMS level 0..1 from an analyser (time domain). */
function rmsLevel(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buf)
  let sumSq = 0
  for (let i = 0; i < buf.length; i++) { const x = (buf[i] - BYTE_MID) / BYTE_MID; sumSq += x * x }
  return Math.sqrt(sumSq / buf.length)
}
/** Max-combine the analyser spectrum into out[] (N bands, 0..1) with a LOG frequency split. */
function maxCombineBands(analyser: AnalyserNode, freqBuf: Uint8Array<ArrayBuffer>, out: Float32Array): void {
  analyser.getByteFrequencyData(freqBuf)
  const total = freqBuf.length, n = out.length, minBin = 1
  for (let i = 0; i < n; i++) {
    const lo = Math.floor(minBin * Math.pow(total / minBin, i / n))
    const hi = Math.max(lo + 1, Math.floor(minBin * Math.pow(total / minBin, (i + 1) / n)))
    let m = 0
    for (let j = lo; j < hi && j < total; j++) if (freqBuf[j] > m) m = freqBuf[j]
    const v = m / 255
    if (v > out[i]) out[i] = v
  }
}

// AudioWorklet recorder: runs on the audio render thread and posts a copy of every
// input quantum back to the main thread. Loaded once via a Blob URL so it needs no
// separate bundled asset. Mono input is duplicated to stereo.
const RECORDER_PROCESSOR = 'oneshot-recorder'
const RECORDER_MODULE = `
class R extends AudioWorkletProcessor {
  process(inputs) {
    const i = inputs[0]
    if (i && i.length && i[0] && i[0].length) {
      const a = Float32Array.from(i[0])
      const b = i[1] && i[1].length ? Float32Array.from(i[1]) : a.slice()
      this.port.postMessage([a, b], [a.buffer, b.buffer])
    }
    return true
  }
}
registerProcessor('${RECORDER_PROCESSOR}', R)
`

// Flatten captured audio chunks into one contiguous buffer.
function flatten(chunks: Float32Array[]): Float32Array {
  let total = 0
  for (const c of chunks) total += c.length
  const flat = new Float32Array(total)
  let off = 0
  for (const c of chunks) {
    flat.set(c, off)
    off += c.length
  }
  return flat
}

// Flatten captured audio chunks and slice out [start, start+length) samples.
function concatSlice(chunks: Float32Array[], start: number, length: number): Float32Array {
  return flatten(chunks).slice(start, start + length)
}

// First sample (in [from, to)) whose level clears the noise floor — the SFX onset.
// Used to trim leading silence so a one-shot's attack lands on the very first frame
// regardless of where the capture started relative to the Strudel cycle boundary.
const ONSET_THRESHOLD = 0.003
function findOnset(left: Float32Array, right: Float32Array, from: number, to: number): number {
  const end = Math.min(to, left.length)
  for (let i = from; i < end; i++) {
    if (Math.abs(left[i]) > ONSET_THRESHOLD || Math.abs(right[i]) > ONSET_THRESHOLD) return i
  }
  return from // silent capture: fall back to the warm-up boundary
}

// Browser-only Strudel backend. Imports @strudel/web (which touches `window`),
// so it must never be imported from Node/unit tests — those depend on the pure
// MusicDirector and the IStrudelEngine interface instead.
export class StrudelWebEngine implements IStrudelEngine {
  #initialized = false
  #initPromise: Promise<void> | null = null
  #volume = DEFAULT_VOLUME
  #recorderModuleLoaded = false
  #analyser: AnalyserNode | null = null
  #timeBuf: Uint8Array<ArrayBuffer> | null = null
  #freqBuf: Uint8Array<ArrayBuffer> | null = null

  get isReady() {
    return this.#initialized
  }

  init(): Promise<void> {
    if (this.#initialized) return Promise.resolve()
    if (this.#initPromise) return this.#initPromise
    this.#initPromise = (async () => {
      await initStrudel({
        prebake: async () => {
          // Match strudel.cc's palette so authored stems can use its full sound
          // set (banks, piano, EmuSP12 hits incl. oh/rim, vcsl, mridangam,
          // wavetables). dirt-samples loads last so its familiar bd/sd/hh/... stay
          // the default, while EmuSP12 still supplies the hits dirt lacks (oh, rim).
          // Built-in oscillators/noise need no samples. Never block init.
          try {
            await Promise.all([
              samples(`${DOUGH}tidal-drum-machines.json`),
              samples(`${DOUGH}piano.json`),
              samples(`${DOUGH}Dirt-Samples.json`),
              samples(`${DOUGH}EmuSP12.json`),
              samples(`${DOUGH}vcsl.json`),
              samples(`${DOUGH}mridangam.json`),
              samples(WAVEFORMS),
              samples(UZU_WAVETABLES),
            ])
            await samples(DIRT_SAMPLES)
          } catch (e) {
            console.warn('[StrudelWebEngine] sample load failed:', e)
          }
        },
      })
      // initStrudel only schedules worklet loading on the first document mousedown
      // and never awaits it. Worklet-backed sounds (e.g. supersaw) would then build
      // an AudioWorkletNode before audioWorklet.addModule() has run. init() runs
      // inside the user's play gesture, so await initAudio() here to load worklets
      // (and resume the context) before any playback.
      await initAudio()
      await evaluate(PRELUDE_CODE)
      this.#initialized = true
      this.#applyVolume()
    })()
    return this.#initPromise
  }

  async play(code: string): Promise<void> {
    await this.init()
    await evaluate(code)
    this.#applyVolume()
  }

  stop(): void {
    if (this.#initialized) hush()
  }

  setVolume(volume: number): void {
    this.#volume = clamp01(volume)
    this.#applyVolume()
  }

  /** Compensate the post-gain analyser tap back to VIS_REF_LEVEL so the visualizer is volume-independent. */
  #visGain(): number {
    return Math.min(VIS_MAX_GAIN, VIS_REF_LEVEL / Math.max(this.#volume, VIS_MIN_VOLUME))
  }

  readLevel(): number {
    this.#ensureAnalyser()
    if (!this.#analyser || !this.#timeBuf) return 0
    return Math.min(1, rmsLevel(this.#analyser, this.#timeBuf) * this.#visGain())
  }

  readBands(out: Float32Array): void {
    this.#ensureAnalyser()
    if (!this.#analyser || !this.#freqBuf) return
    maxCombineBands(this.#analyser, this.#freqBuf, out)
    const g = this.#visGain()
    if (g !== 1) for (let i = 0; i < out.length; i++) out[i] = Math.min(1, out[i] * g)
  }

  /** Lazily tap the superdough master node with an analyser. The controller is created on the
   *  first sound, so this connects once playback has begun; safe to call every frame. */
  #ensureAnalyser(): void {
    if (this.#analyser) return
    try {
      const controller = getSuperdoughAudioController()
      const node = controller?.output?.destinationGain ?? controller?.output?.output
      if (!node) return
      const ctx = getAudioContext()
      if (!ctx) return
      const analyser = ctx.createAnalyser()
      analyser.fftSize = ANALYSER_FFT
      node.connect(analyser)   // passive tap (no onward connection) — doesn't alter the output
      this.#analyser = analyser
      this.#timeBuf = new Uint8Array(analyser.fftSize)
      this.#freqBuf = new Uint8Array(analyser.frequencyBinCount)
    } catch {
      // Controller/context not ready yet; retried on the next read.
    }
  }

  /**
   * Render a full Strudel program to a stereo PCM-16 WAV loop of `cycles` cycles.
   * Real-time capture skips one warm-up cycle (start transient), then keeps
   * exactly `cycles` cycles. The window length is an integer number of cycles, so
   * any pattern whose period divides `cycles` loops seamlessly regardless of
   * capture phase.
   */
  async renderToWav(code: string, cycles: number): Promise<Uint8Array> {
    await this.init()
    const sampleRate = getAudioContext().sampleRate
    const cycleDur = (BEATS_PER_CYCLE / FIXED_BPM) * 60 // seconds per cycle
    const warmupSamples = Math.round(cycleDur * sampleRate)
    const windowSamples = Math.round(cycles * cycleDur * sampleRate)

    const { left, right } = await this.#capture(code, warmupSamples + windowSamples)
    const l = concatSlice(left, warmupSamples, windowSamples)
    const r = concatSlice(right, warmupSamples, windowSamples)
    return encodeWav([l, r], sampleRate)
  }

  /**
   * Render a Strudel program to a one-shot WAV of `lengthMs` milliseconds. Unlike
   * a loop, phase matters: the capture start is not aligned to a Strudel cycle, so
   * we cannot rely on the warm-up boundary to place the attack. Instead we capture
   * past the warm-up, detect the onset (first sample above the noise floor) and
   * slice from there — guaranteeing zero leading silence. `mono` downmixes L/R to a
   * single channel (for the game's 3D positional audio).
   */
  async renderOneShotToWav(
    code: string,
    lengthMs: number,
    opts: { mono: boolean },
  ): Promise<Uint8Array> {
    await this.init()
    const sampleRate = getAudioContext().sampleRate
    const cycleDur = (BEATS_PER_CYCLE / FIXED_BPM) * 60
    const cycleSamples = Math.round(cycleDur * sampleRate)
    const warmupSamples = cycleSamples
    const lengthSamples = Math.round((lengthMs / 1000) * sampleRate)
    // Capture warm-up + one cycle (the onset retriggers within it) + the output
    // length, so [onset, onset+length] always lies inside the captured buffer.
    const need = warmupSamples + cycleSamples + lengthSamples

    const { left, right } = await this.#capture(code, need)
    const l = flatten(left)
    const r = flatten(right)
    const onset = findOnset(l, r, warmupSamples, warmupSamples + cycleSamples)
    const sliceL = l.slice(onset, onset + lengthSamples)
    const sliceR = r.slice(onset, onset + lengthSamples)

    if (opts.mono) {
      const mono = new Float32Array(sliceL.length)
      for (let i = 0; i < mono.length; i++) mono[i] = (sliceL[i] + sliceR[i]) / 2
      return encodeWav([mono], sampleRate)
    }
    return encodeWav([sliceL, sliceR], sampleRate)
  }

  /**
   * Real-time tap of the superdough master gain into the AudioWorklet recorder.
   * Captures on the audio render thread (not the main thread): a ScriptProcessorNode
   * drops buffer quanta whenever the main thread stalls, injecting clicks the source
   * never produced; the worklet copies every quantum reliably and the main thread
   * merely drains the message queue. Returns the captured channels (≥ `need` samples)
   * at unity gain, so the result is never scaled by the UI volume fader.
   */
  async #capture(
    code: string,
    need: number,
  ): Promise<{ left: Float32Array[]; right: Float32Array[]; sampleRate: number }> {
    await this.init()
    const ctx = getAudioContext()
    const controller = getSuperdoughAudioController()
    const master = controller?.output?.destinationGain ?? controller?.output?.output
    if (!master) throw new Error('[StrudelWebEngine] no master node to tap')

    await this.#ensureRecorderModule(ctx)
    const recorder = new AudioWorkletNode(ctx, RECORDER_PROCESSOR, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    })
    const silent = ctx.createGain()
    silent.gain.value = 0
    master.connect(recorder)
    recorder.connect(silent)
    silent.connect(ctx.destination)

    const left: Float32Array[] = []
    const right: Float32Array[] = []
    let captured = 0
    const done = new Promise<void>((resolve) => {
      recorder.port.onmessage = (e) => {
        if (captured >= need) return
        const [l, r] = e.data as [Float32Array, Float32Array]
        left.push(l)
        right.push(r)
        captured += l.length
        if (captured >= need) resolve()
      }
    })

    const prevGain = master.gain.value
    master.gain.value = 1
    hush()
    await evaluate(code)
    try {
      await done
    } finally {
      hush()
      master.disconnect(recorder)
      recorder.disconnect()
      silent.disconnect()
      recorder.port.onmessage = null
      master.gain.value = prevGain
    }

    return { left, right, sampleRate: ctx.sampleRate }
  }

  async #ensureRecorderModule(ctx: AudioContext): Promise<void> {
    if (this.#recorderModuleLoaded) return
    const blob = new Blob([RECORDER_MODULE], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    try {
      await ctx.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }
    this.#recorderModuleLoaded = true
  }

  #applyVolume(): void {
    try {
      const controller = getSuperdoughAudioController()
      const node = controller?.output?.destinationGain ?? controller?.output?.output
      if (node) node.gain.value = this.#volume
    } catch {
      // Controller is created lazily on first sound; volume re-applies after play().
    }
  }
}
