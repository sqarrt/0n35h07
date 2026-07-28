import * as THREE from 'three'
import { SFX_LIBRARY } from './sfxLibrary'
import { ANALYSER_FFT, analyserLevel, fillBands } from '../AudioAnalysis'
import type { ISfxEngine, SfxEvent } from './types'

// Base SFX level (user 0..1 on top of it). High, because the supplied sounds are quiet
// (peaks 0.04–0.17 → huge headroom to clipping): the old 0.9 ceiling felt quiet even at 100%.
// With this base the slider at ~40% gives the old "100%" loudness, and 100% is noticeably louder.
const SFX_MASTER_GAIN = 2.25
const SFX_REF_DISTANCE = 6
const SFX_ROLLOFF = 1
const SFX_MAX_DISTANCE = 60
// De-click: buffers start/end on a non-zero sample (e.g. jump ends at ~0.023) → start/cut
// at full gain = signal discontinuity = click. A micro-fade from zero on attack and to zero on tail removes it.
const DECLICK_ATTACK_SEC = 0.003   // short attack — the percussion snap barely suffers
const DECLICK_RELEASE_SEC = 0.006  // tail matters more (a cut on a non-zero sample is the main click source)
// Per-event volumes (sounds are NOT normalized): UI noticeably quieter than gameplay.
const SFX_GAIN: Record<SfxEvent, number> = {
  beam_fire: 0.9, beam_fire_rage: 0.9, beam_fire_singularity: 0.9, block: 0.9, shield_up: 0.8, shield_down: 0.8, cooldown_ready: 0.5,
  dash: 0.8, jump: 0.7, land: 0.6, death: 1.0, respawn: 0.9,
  ui_click: 0.4, ui_hover: 0.3, ui_toggle: 0.4, ready: 0.5, room_join: 0.5, count_tick: 0.6, go: 0.7,
  catalyst: 0.85, double_kill: 0.85, triple_kill: 0.85, singularity: 0.9,
  shield_loop: 0.5, ghost_loop: 0.5,
}

/** SFX engine on three.js audio. One listener (one AudioContext) for the whole app. */
export class ThreeSfxEngine implements ISfxEngine {
  private listener = new THREE.AudioListener()
  private buffers = new Map<SfxEvent, AudioBuffer>()
  private parent: THREE.Object3D | null = null
  private loops = new Map<string, THREE.Audio | THREE.PositionalAudio>()
  private analyser: AnalyserNode
  private analyserBuf = new Uint8Array(new ArrayBuffer(ANALYSER_FFT))
  private freqBuf = new Uint8Array(new ArrayBuffer(ANALYSER_FFT / 2))

  constructor() {
    this.setMasterGain(1)
    // Tap the listener output into the analyser (for visualization; doesn't affect sound).
    this.analyser = this.listener.context.createAnalyser()
    this.analyser.fftSize = ANALYSER_FFT
    this.listener.getInput().connect(this.analyser)
  }

  /** Current SFX RMS level 0..1 (for visualization). */
  readLevel(): number { return analyserLevel(this.analyser, this.analyserBuf) }
  /** SFX spectrum into out[] (max-combining). */
  readBands(out: Float32Array): void { fillBands(this.analyser, this.freqBuf, out) }

  async load(): Promise<void> {
    const ctx = this.listener.context
    const entries = Object.entries(SFX_LIBRARY) as [SfxEvent, string][]
    await Promise.all(entries.map(async ([id, url]) => {
      if (this.buffers.has(id)) return
      const data = await (await fetch(url)).arrayBuffer()
      this.buffers.set(id, await ctx.decodeAudioData(data))
    }))
  }

  attach(camera: THREE.Camera, parent: THREE.Object3D): void {
    camera.add(this.listener)
    this.parent = parent
    this.ready()   // resume the context on entering the match
  }
  detach(): void {
    for (const key of [...this.loops.keys()]) this.stopLoop(key)
    this.listener.removeFromParent()
    this.parent = null
  }

  /** Positional node with shared distance settings and equalpower panning.
   *  HRTF (three.js default) with a moving listener (it's on the camera) recomputes the convolution every frame
   *  → crackle/zipper. equalpower is constant-power L/R with no convolution, no artifacts. */
  private makePositional(buf: AudioBuffer): THREE.PositionalAudio {
    const a = new THREE.PositionalAudio(this.listener)
    a.setBuffer(buf)
    a.setRefDistance(SFX_REF_DISTANCE)
    a.setRolloffFactor(SFX_ROLLOFF)
    a.setMaxDistance(SFX_MAX_DISTANCE)
    a.panner.panningModel = 'equalpower'
    return a
  }

  /** Start a one-shot with a de-click envelope: gain rises from zero (attack) and falls to zero by the buffer end. */
  private playOneShot(a: THREE.Audio | THREE.PositionalAudio, buf: AudioBuffer, volume: number): void {
    const ctx = this.listener.context
    const t0 = ctx.currentTime
    const end = t0 + buf.duration
    const atkEnd = Math.min(t0 + DECLICK_ATTACK_SEC, end)
    const relStart = Math.max(atkEnd, end - DECLICK_RELEASE_SEC)
    const g = a.gain.gain
    g.cancelScheduledValues(t0)
    g.setValueAtTime(0, t0)
    g.linearRampToValueAtTime(volume, atkEnd)   // de-click attack from zero
    g.setValueAtTime(volume, relStart)
    g.linearRampToValueAtTime(0, end)            // de-click tail to zero (cut on a non-zero sample)
    a.play()
  }

  playAt(event: SfxEvent, pos: THREE.Vector3, gain = 1): void {
    const buf = this.buffers.get(event)
    if (!buf || !this.parent || !this.ready()) return
    const a = this.makePositional(buf)
    a.position.copy(pos)
    this.parent.add(a)
    a.updateMatrixWorld()
    a.onEnded = () => { a.removeFromParent(); a.disconnect() }
    this.playOneShot(a, buf, (SFX_GAIN[event] ?? 1) * gain)
  }

  play2D(event: SfxEvent, gain = 1): void {
    const buf = this.buffers.get(event)
    if (!buf || !this.ready()) return
    const a = new THREE.Audio(this.listener)
    a.setBuffer(buf)
    a.onEnded = () => { a.disconnect() }
    this.playOneShot(a, buf, (SFX_GAIN[event] ?? 1) * gain)
  }

  has(event: SfxEvent): boolean { return this.buffers.has(event) }

  startLoop(event: SfxEvent, key: string, target: THREE.Object3D | null): void {
    if (this.loops.has(key)) return
    const buf = this.buffers.get(event)
    if (!buf || !this.ready()) return
    // target=null → own player: 2D loop (source at the listener → positional panner degenerates, glitch).
    const a = target ? this.makePositional(buf) : new THREE.Audio(this.listener)
    if (!target) a.setBuffer(buf)
    a.setLoop(true)
    a.setVolume(SFX_GAIN[event] ?? 0.5)
    if (target) target.add(a)
    a.play()
    this.loops.set(key, a)
  }
  stopLoop(key: string): void {
    const a = this.loops.get(key)
    if (!a) return
    try { a.stop() } catch { /* the source may not have started */ }
    a.removeFromParent()
    a.disconnect()
    this.loops.delete(key)
  }

  /** User level 0..1 on top of the reference SFX_MASTER_GAIN (1 = the ear-tuned reference). */
  setMasterGain(gain: number): void {
    const level = Math.min(1, Math.max(0, gain))
    this.listener.setMasterVolume(SFX_MASTER_GAIN * level)
  }
  dispose(): void { this.detach(); this.buffers.clear() }

  /** Is the context ready to play? If not — try to resume (but do NOT queue sound). */
  private ready(): boolean {
    const ctx = this.listener.context
    if (ctx.state === 'running') return true
    void ctx.resume()   // resumes on a gesture; until then we don't pile up sounds (else a batch fires at once on resume)
    return false
  }
}
