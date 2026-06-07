import type { StemLibrary, Arrangement, IMusicEngine } from './types'

const LOOP_SECONDS = 8.0          // музыкальная длина лупа (НЕ длина файла 8.0065 — там Opus-паддинг)
const SCHEDULE_AHEAD_SEC = 0.25   // насколько вперёд планируем источники
const SCHEDULER_TICK_MS = 50      // период тика планировщика
const START_DELAY_SEC = 0.12      // отступ первого лупа от currentTime (на декод/планирование)
const FADE_SEC = 0.04             // фейд-ин впервые вступающего голоса (анти-щелчок)
const MASTER_GAIN_DEFAULT = 0.6

/** Web Audio движок: декод стемов, lookahead-планировщик, семпл-точное зацикливание + кроссфейд. */
export class WebAudioMusicEngine implements IMusicEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private provider: ((loopIndex: number) => Arrangement) | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextBoundary = 0
  private _loopIndex = 0
  private prevIds = new Set<string>()
  private _active = new Set<string>()

  get loopIndex(): number { return Math.max(0, this._loopIndex - 1) }
  activeStemIds(): string[] { return [...this._active] }

  async load(library: StemLibrary): Promise<void> {
    const ctx = this.ensureCtx()
    const refs = Object.values(library).flat()
    await Promise.all(refs.map(async ref => {
      if (this.buffers.has(ref.id)) return
      const data = await (await fetch(ref.url)).arrayBuffer()
      this.buffers.set(ref.id, await ctx.decodeAudioData(data))
    }))
  }

  async start(provider: (loopIndex: number) => Arrangement): Promise<void> {
    const ctx = this.ensureCtx()
    this.provider = provider
    if (ctx.state === 'suspended') await ctx.resume()
    this._loopIndex = 0
    this.prevIds.clear()
    this.nextBoundary = ctx.currentTime + START_DELAY_SEC
    if (this.timer == null) this.timer = setInterval(() => this.tick(), SCHEDULER_TICK_MS)
    this.tick()
  }

  stop(): void {
    if (this.timer != null) { clearInterval(this.timer); this.timer = null }
    this._active.clear()
    this.prevIds.clear()
  }

  setMasterGain(gain: number): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05)
  }

  dispose(): void {
    this.stop()
    void this.ctx?.close().catch(() => {})
    this.ctx = null
    this.master = null
    this.buffers.clear()
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = MASTER_GAIN_DEFAULT
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  private tick(): void {
    const ctx = this.ctx
    const provider = this.provider
    if (!ctx || !provider || !this.master) return
    while (this.nextBoundary < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this.scheduleLoop(this._loopIndex, this.nextBoundary, provider)
      this.nextBoundary += LOOP_SECONDS
      this._loopIndex++
    }
  }

  private scheduleLoop(loopIndex: number, when: number, provider: (i: number) => Arrangement): void {
    const ctx = this.ctx!
    const master = this.master!
    const arr = provider(loopIndex)
    const ids = new Set(arr.map(v => v.stemId))
    for (const v of arr) {
      const buf = this.buffers.get(v.stemId)
      if (!buf) continue
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = ctx.createGain()
      if (this.prevIds.has(v.stemId)) {
        g.gain.setValueAtTime(v.gain, when)               // продолжающийся голос — стык встык, без фейда
      } else {
        g.gain.setValueAtTime(0, when)                    // впервые вступает — короткий фейд-ин
        g.gain.linearRampToValueAtTime(v.gain, when + FADE_SEC)
      }
      src.connect(g).connect(master)
      src.start(when)
      src.stop(when + LOOP_SECONDS)   // обрезаем хвост-паддинг файла → ровно 8.0с, без наложения с след. лупом
    }
    this.prevIds = ids
    this._active = ids
  }
}
