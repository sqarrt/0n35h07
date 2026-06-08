import * as THREE from 'three'
import { SFX_LIBRARY } from './sfxLibrary'
import { ANALYSER_FFT, analyserLevel } from '../AudioAnalysis'
import type { ISfxEngine, SfxEvent } from './types'

// Базовый уровень эффектов (поверх него — пользовательский 0..1). Высокий, т.к. присланные звуки тихие
// (пики 0.04–0.17 → запас до клиппинга огромен): прежний потолок 0.9 ощущался тихо даже на 100%.
// При этом базе ползунок ~40% даёт прежнюю «100%»-громкость, а 100% — заметно громче.
const SFX_MASTER_GAIN = 2.25
const SFX_REF_DISTANCE = 6
const SFX_ROLLOFF = 1
const SFX_MAX_DISTANCE = 60
// Де-клик: буферы стартуют/кончаются на ненулевом семпле (напр. jump кончается на ~0.023) → старт/обрыв
// на полном гейне = разрыв сигнала = щелчок. Микро-фейд из нуля на атаке и в ноль на хвосте убирает его.
const DECLICK_ATTACK_SEC = 0.003   // короткая атака — снап перкуссии почти не страдает
const DECLICK_RELEASE_SEC = 0.006  // хвост важнее (обрыв на ненулевом семпле — главный источник щелчка)
// Громкости per-event (звуки НЕ нормализованы): UI заметно тише геймплея.
const SFX_GAIN: Record<SfxEvent, number> = {
  beam_fire: 0.9, block: 0.9, shield_up: 0.8, shield_down: 0.8, cooldown_ready: 0.5,
  dash: 0.8, jump: 0.7, land: 0.6, death: 1.0, respawn: 0.9,
  ui_click: 0.4, ui_hover: 0.3, ui_toggle: 0.4, ready: 0.5, lobby_join: 0.5, count_tick: 0.6, go: 0.7,
  shield_loop: 0.5, ghost_loop: 0.5,
}

/** SFX-движок на three.js audio. Один listener (один AudioContext) на всё приложение. */
export class ThreeSfxEngine implements ISfxEngine {
  private listener = new THREE.AudioListener()
  private buffers = new Map<SfxEvent, AudioBuffer>()
  private parent: THREE.Object3D | null = null
  private loops = new Map<string, THREE.Audio | THREE.PositionalAudio>()
  private analyser: AnalyserNode
  private analyserBuf = new Uint8Array(new ArrayBuffer(ANALYSER_FFT))

  constructor() {
    this.setMasterGain(1)
    // Отвод выхода listener в анализатор (для визуализации; на звук не влияет).
    this.analyser = this.listener.context.createAnalyser()
    this.analyser.fftSize = ANALYSER_FFT
    this.listener.getInput().connect(this.analyser)
  }

  /** Текущий RMS-уровень эффектов 0..1 (для визуализации). */
  readLevel(): number { return analyserLevel(this.analyser, this.analyserBuf) }

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
    this.resume()
  }
  detach(): void {
    for (const key of [...this.loops.keys()]) this.stopLoop(key)
    this.listener.removeFromParent()
    this.parent = null
  }

  /** Позиционная нода с общей настройкой дистанции и панорамированием equalpower.
   *  HRTF (дефолт three.js) при движущемся listener (он на камере) пересчитывает свёртку каждый кадр
   *  → треск/зиппер. equalpower — constant-power L/R без свёртки, без артефактов. */
  private makePositional(buf: AudioBuffer): THREE.PositionalAudio {
    const a = new THREE.PositionalAudio(this.listener)
    a.setBuffer(buf)
    a.setRefDistance(SFX_REF_DISTANCE)
    a.setRolloffFactor(SFX_ROLLOFF)
    a.setMaxDistance(SFX_MAX_DISTANCE)
    a.panner.panningModel = 'equalpower'
    return a
  }

  /** Старт one-shot с де-клик огибающей: gain входит из нуля (атака) и уходит в ноль к концу буфера. */
  private playOneShot(a: THREE.Audio | THREE.PositionalAudio, buf: AudioBuffer, volume: number): void {
    const ctx = this.listener.context
    const t0 = ctx.currentTime
    const end = t0 + buf.duration
    const atkEnd = Math.min(t0 + DECLICK_ATTACK_SEC, end)
    const relStart = Math.max(atkEnd, end - DECLICK_RELEASE_SEC)
    const g = a.gain.gain
    g.cancelScheduledValues(t0)
    g.setValueAtTime(0, t0)
    g.linearRampToValueAtTime(volume, atkEnd)   // де-клик атака из нуля
    g.setValueAtTime(volume, relStart)
    g.linearRampToValueAtTime(0, end)            // де-клик хвост в ноль (обрыв на ненулевом семпле)
    a.play()
  }

  playAt(event: SfxEvent, pos: THREE.Vector3, gain = 1): void {
    const buf = this.buffers.get(event)
    if (!buf || !this.parent) return
    this.resume()
    const a = this.makePositional(buf)
    a.position.copy(pos)
    this.parent.add(a)
    a.updateMatrixWorld()
    a.onEnded = () => { a.removeFromParent(); a.disconnect() }
    this.playOneShot(a, buf, (SFX_GAIN[event] ?? 1) * gain)
  }

  play2D(event: SfxEvent, gain = 1): void {
    const buf = this.buffers.get(event)
    if (!buf) return
    this.resume()
    const a = new THREE.Audio(this.listener)
    a.setBuffer(buf)
    a.onEnded = () => { a.disconnect() }
    this.playOneShot(a, buf, (SFX_GAIN[event] ?? 1) * gain)
  }

  startLoop(event: SfxEvent, key: string, target: THREE.Object3D | null): void {
    if (this.loops.has(key)) return
    const buf = this.buffers.get(event)
    if (!buf) return
    this.resume()
    // target=null → свой игрок: 2D-луп (источник у listener → позиционный panner вырождается, кряк).
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
    try { a.stop() } catch { /* источник мог не стартовать */ }
    a.removeFromParent()
    a.disconnect()
    this.loops.delete(key)
  }

  /** Пользовательский уровень 0..1 поверх эталонного SFX_MASTER_GAIN (1 = настроенный на слух эталон). */
  setMasterGain(gain: number): void {
    const level = Math.min(1, Math.max(0, gain))
    this.listener.setMasterVolume(SFX_MASTER_GAIN * level)
  }
  dispose(): void { this.detach(); this.buffers.clear() }

  private resume(): void {
    if (this.listener.context.state === 'suspended') void this.listener.context.resume()
  }
}
