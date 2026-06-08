import type { StemLibrary, Arrangement, IMusicEngine } from './types'

const LOOP_SECONDS = 8.0          // музыкальная длина лупа (НЕ длина файла 8.0065 — там Opus-паддинг)
const SCHEDULE_AHEAD_SEC = 0.25   // насколько вперёд планируем источники
const SCHEDULER_TICK_MS = 50      // период тика планировщика
const START_DELAY_SEC = 0.12      // отступ первого лупа от currentTime (на декод/планирование)
const CROSSFADE_SEC = 0.12        // длина кроссфейда при подмене стема: уходящий «хвост» и входящий
                                  // голос звучат внахлёст после границы (сглаживает стык бас→бас, кик→кик)
const START_FADE_SEC = 0.5        // мягкий фейд-ин всей музыки на старте (вход в бой)
const END_FADE_SEC = 0.5          // мягкий фейд-аут всей музыки на завершении матча
const MASTER_GAIN_DEFAULT = 0.6
const FADE_CURVE_POINTS = 32      // точек в equal-power кривой кроссфейда
const DECLICK_SEC = 0.003         // микро-фейд от/до нуля на краях каждого источника. Буферы стемов
                                  // стартуют/кончаются на НЕнулевом семпле (особенно бас: buffer[0]≈+0.08,
                                  // buffer[end]≈-0.16) → старт/обрыв на полном гейне = разрыв сигнала = щелчок.

/** 'none' — gain держится ровно (с де-клик-краями); 'in'/'out' — equal-power кроссфейд вверх/вниз. */
type Fade = 'none' | 'in' | 'out'

/** Equal-power кривая кроссфейда: 'in' = gain·sin, 'out' = gain·cos (1/4 периода).
 *  Сумма мощностей пары out+in держится постоянной → переход без провала громкости.
 *  Обе кривые стартуют с нуля (для 'out' принудительно c[0]=0) — свежий источник не должен
 *  начинать звук с ненулевого buffer[0] на полном гейне, иначе щелчок. */
export function equalPowerCurve(gain: number, fade: 'in' | 'out'): Float32Array {
  const curve = new Float32Array(FADE_CURVE_POINTS)
  for (let i = 0; i < FADE_CURVE_POINTS; i++) {
    const t = (i / (FADE_CURVE_POINTS - 1)) * (Math.PI / 2)
    curve[i] = gain * (fade === 'in' ? Math.sin(t) : Math.cos(t))
  }
  if (fade === 'out') curve[0] = 0   // де-клик: хвост начинается от нуля, а не от full на buffer[0]
  return curve
}

/** Web Audio движок: декод стемов, lookahead-планировщик, семпл-точное зацикливание + кроссфейд. */
export class WebAudioMusicEngine implements IMusicEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private provider: ((loopIndex: number) => Arrangement) | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextBoundary = 0
  private _loopIndex = 0
  private prevVoices = new Map<string, number>()   // stemId играющих голосов → их gain (для кроссфейда подмены)
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
    this.prevVoices.clear()
    // Мягкий фейд-ин всей музыки на входе в бой (0.5с): мастер с 0 до рабочей громкости.
    this.master!.gain.setValueAtTime(0, ctx.currentTime)
    this.master!.gain.linearRampToValueAtTime(MASTER_GAIN_DEFAULT, ctx.currentTime + START_FADE_SEC)
    this.nextBoundary = ctx.currentTime + START_DELAY_SEC
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
    }
    // Планировщик гасим сразу: уже звучащие лупы доиграют под затухающий мастер, новые не нужны.
    if (this.timer != null) { clearInterval(this.timer); this.timer = null }
  }

  stop(): void {
    if (this.timer != null) { clearInterval(this.timer); this.timer = null }
    this._active.clear()
    this.prevVoices.clear()
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
    const arr = provider(loopIndex)
    const ids = new Set(arr.map(v => v.stemId))

    // Уходящие голоса (в прошлом лупе были, теперь их нет): доигрываем короткий «хвост» того же
    // стема с его начала — даунбит хвоста совпадает с границей и встаёт встык к остановившемуся
    // источнику, поэтому стем звучит непрерывно ещё CROSSFADE_SEC и гаснет. Этот хвост перекрывается
    // с фейд-ином входящего голоса → честный кроссфейд без провала в тишину.
    for (const [id, prevGain] of this.prevVoices) {
      if (ids.has(id)) continue
      this.scheduleSource(id, when, prevGain, 'out', CROSSFADE_SEC)   // хвост уходящего — equal-power вниз
    }

    const voices = new Map<string, number>()
    for (const v of arr) {
      const fade: Fade = this.prevVoices.has(v.stemId) ? 'none' : 'in'  // продолжается встык / вступает кроссфейдом
      this.scheduleSource(v.stemId, when, v.gain, fade, LOOP_SECONDS)
      if (this.buffers.has(v.stemId)) voices.set(v.stemId, v.gain)
    }
    this.prevVoices = voices
    this._active = ids
  }

  /** Один источник стема: старт `when`, длина `dur`. Гейн всегда входит из нуля и уходит в ноль
   *  (де-клик-края), иначе старт/обрыв на ненулевом семпле буфера даёт щелчок:
   *   - 'in'   — equal-power вход за CROSSFADE_SEC, затем держится, в конце де-клик-спад;
   *   - 'out'  — хвост: equal-power спад за CROSSFADE_SEC (кривая стартует с нуля → старт без щелчка);
   *   - 'none' — продолжение: микро-фейд из нуля на входе и в ноль на выходе (CROSSFADE не нужен — стык встык). */
  private scheduleSource(stemId: string, when: number, gain: number, fade: Fade, dur: number): void {
    const buf = this.buffers.get(stemId)
    if (!buf || !this.ctx || !this.master) return
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const g = this.ctx.createGain()
    const p = g.gain
    const end = when + dur
    if (fade === 'out') {
      p.setValueCurveAtTime(equalPowerCurve(gain, 'out'), when, CROSSFADE_SEC)   // спад до 0, старт с 0
    } else {
      if (fade === 'in') p.setValueCurveAtTime(equalPowerCurve(gain, 'in'), when, CROSSFADE_SEC)
      else { p.setValueAtTime(0, when); p.linearRampToValueAtTime(gain, when + DECLICK_SEC) }  // 'none' — де-клик вход
      p.setValueAtTime(gain, end - DECLICK_SEC)   // де-клик выход в конце лупа (стем кончается не на нуле)
      p.linearRampToValueAtTime(0, end)
    }
    src.connect(g).connect(this.master)
    src.start(when)
    src.stop(end)
  }
}
