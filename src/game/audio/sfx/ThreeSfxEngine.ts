import * as THREE from 'three'
import { SFX_LIBRARY } from './sfxLibrary'
import type { ISfxEngine, SfxEvent } from './types'

const SFX_MASTER_GAIN = 0.9
const SFX_REF_DISTANCE = 6
const SFX_ROLLOFF = 1
const SFX_MAX_DISTANCE = 60
// Громкости per-event (звуки НЕ нормализованы): UI заметно тише геймплея.
const SFX_GAIN: Record<SfxEvent, number> = {
  beam_fire: 0.9, block: 0.9, shield_up: 0.8, shield_down: 0.8, cooldown_ready: 0.5,
  dash: 0.8, jump: 0.7, land: 0.6, death: 1.0, respawn: 0.9,
  ui_click: 0.4, ui_hover: 0.3, ui_toggle: 0.4, ready: 0.5, lobby_join: 0.5, count_tick: 0.6,
  shield_loop: 0.5, ghost_loop: 0.5,
}

/** SFX-движок на three.js audio. Один listener (один AudioContext) на всё приложение. */
export class ThreeSfxEngine implements ISfxEngine {
  private listener = new THREE.AudioListener()
  private buffers = new Map<SfxEvent, AudioBuffer>()
  private parent: THREE.Object3D | null = null
  private loops = new Map<string, THREE.PositionalAudio>()

  constructor() { this.setMasterGain(1) }

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

  playAt(event: SfxEvent, pos: THREE.Vector3, gain = 1): void {
    const buf = this.buffers.get(event)
    if (!buf || !this.parent) return
    this.resume()
    const a = this.makePositional(buf)
    a.setVolume((SFX_GAIN[event] ?? 1) * gain)
    a.position.copy(pos)
    this.parent.add(a)
    a.updateMatrixWorld()
    a.onEnded = () => { a.removeFromParent(); a.disconnect() }
    a.play()
  }

  play2D(event: SfxEvent, gain = 1): void {
    const buf = this.buffers.get(event)
    if (!buf) return
    this.resume()
    const a = new THREE.Audio(this.listener)
    a.setBuffer(buf)
    a.setVolume((SFX_GAIN[event] ?? 1) * gain)
    a.onEnded = () => { a.disconnect() }
    a.play()
  }

  startLoop(event: SfxEvent, key: string, target: THREE.Object3D): void {
    if (this.loops.has(key)) return
    const buf = this.buffers.get(event)
    if (!buf) return
    this.resume()
    const a = this.makePositional(buf)
    a.setLoop(true)
    a.setVolume(SFX_GAIN[event] ?? 0.5)
    target.add(a)
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
