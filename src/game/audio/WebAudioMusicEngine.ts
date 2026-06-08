import type { StemLibrary, Arrangement, IMusicEngine } from './types'

const LOOP_SECONDS = 8.0          // музыкальная длина лупа (НЕ длина файла 8.0065 — там Opus-паддинг)
const SCHEDULE_AHEAD_SEC = 2.0    // насколько вперёд планируем источники. С запасом: луп длинный (8с) и
                                  // планируется раз в 8с, поэтому подвисание главного потока (тяжёлый кадр,
                                  // GC, тротлинг setInterval в неактивной вкладке) дольше окна планирования
                                  // роняет целый луп в тишину. 2с переживают обычные хитчи без провала.
const SCHEDULER_TICK_MS = 50      // период тика планировщика
const START_DELAY_SEC = 0.12      // отступ первого лупа от currentTime (на декод/планирование)
const CROSSFADE_SEC = 0.12        // длина кроссфейда при подмене стема: уходящий «хвост» и входящий
                                  // голос звучат внахлёст после границы (сглаживает стык бас→бас, кик→кик)
const START_FADE_SEC = 0.5        // мягкий фейд-ин всей музыки на старте (вход в бой)
const END_FADE_SEC = 0.8          // фейд-аут сухого сигнала на завершении матча
const MASTER_GAIN_DEFAULT = 0.6
// Затухающее эхо на завершении матча: молчит во время игры, включается на fadeOut и звенит хвостом,
// чтобы трек не обрывался резко. delay→feedback→delay (петля декея), вход гейтится echoSend.
const ECHO_DELAY_SEC = 0.35       // время задержки эхо (между повторами)
const ECHO_FEEDBACK = 0.5         // коэффициент обратной связи (<1): каждый повтор тише, хвост ~2с
const ECHO_WET = 0.45             // громкость эхо-выхода
// Нормализация громкости стемов: каждый стем приводим к целевому RMS (тихие лиды слышны, громкие
// кики не выбиваются), но множитель ограничиваем так, чтобы ПИК не вышел за потолок (транзиенты
// киков не бьют по ушам). Считается из декодированного PCM → детерминировано и одинаково у пиров.
const NORM_TARGET_RMS = 0.10
const NORM_MIN_GAIN = 0.25
const NORM_MAX_GAIN = 4.0
const NORM_PEAK_CEILING = 0.9
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

/** Нормализующий множитель громкости стема: к целевому RMS, ограниченный по пику (анти-«бьёт по ушам»). */
export function normGainFor(rms: number, peak: number): number {
  if (rms <= 0) return 1
  let g = Math.min(NORM_MAX_GAIN, Math.max(NORM_MIN_GAIN, NORM_TARGET_RMS / rms))
  if (peak > 0 && peak * g > NORM_PEAK_CEILING) g = NORM_PEAK_CEILING / peak   // пик-сейф важнее RMS-цели
  return g
}

/** RMS и пик буфера по всем каналам (для нормализации громкости). */
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

/** Web Audio движок: декод стемов, lookahead-планировщик, семпл-точное зацикливание + кроссфейд. */
export class WebAudioMusicEngine implements IMusicEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private echoSend: GainNode | null = null   // гейт входа в эхо: 0 во время игры, открывается на fadeOut
  private buffers = new Map<string, AudioBuffer>()
  private norm = new Map<string, number>()   // stemId → нормализующий множитель громкости
  private provider: ((loopIndex: number) => Arrangement) | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextBoundary = 0
  private _loopIndex = 0
  private prevVoices = new Map<string, number>()   // stemId играющих голосов → их gain (для кроссфейда подмены)
  private _active = new Set<string>()
  private userGain = 1   // пользовательский уровень музыки 0..1 (поверх эталона MASTER_GAIN_DEFAULT)

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
    // Сброс эха: при переиспользовании движка (музыка меню) прошлый fadeOut оставил echoSend открытым —
    // иначе после возврата эхо подмешивается и копится. Закрываем перед новым стартом.
    if (this.echoSend) { this.echoSend.gain.cancelScheduledValues(now); this.echoSend.gain.setValueAtTime(0, now) }
    // Мягкий фейд-ин всей музыки: мастер с 0 до рабочей громкости × пользовательский уровень за fadeInSec.
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
      // Открываем эхо: затухающий сухой сигнал попадает в delay и звенит хвостом ~2с (не резкий обрыв).
      if (this.echoSend) {
        this.echoSend.gain.cancelScheduledValues(now)
        this.echoSend.gain.setValueAtTime(0, now)
        this.echoSend.gain.linearRampToValueAtTime(1, now + 0.05)
      }
    }
    // Планировщик гасим сразу: уже звучащие лупы доиграют под затухающий мастер, новые не нужны.
    if (this.timer != null) { clearInterval(this.timer); this.timer = null }
  }

  stop(): void {
    if (this.timer != null) { clearInterval(this.timer); this.timer = null }
    this._active.clear()
    this.prevVoices.clear()
  }

  /** Пользовательский уровень музыки 0..1 (1 = эталон MASTER_GAIN_DEFAULT). Применяется живьём и на старте. */
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
    this.buffers.clear()
    this.norm.clear()
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = MASTER_GAIN_DEFAULT
      this.master.connect(this.ctx.destination)                         // сухой сигнал
      // Эхо-шина: master → echoSend(0) → delay → feedback↺ → echoWet → destination.
      // echoSend закрыт во время игры (эхо не накапливается); открывается на fadeOut.
      this.echoSend = this.ctx.createGain()
      this.echoSend.gain.value = 0
      const delay = this.ctx.createDelay(1.0)
      delay.delayTime.value = ECHO_DELAY_SEC
      const feedback = this.ctx.createGain()
      feedback.gain.value = ECHO_FEEDBACK
      const echoWet = this.ctx.createGain()
      echoWet.gain.value = ECHO_WET
      this.master.connect(this.echoSend).connect(delay)
      delay.connect(feedback).connect(delay)                            // петля обратной связи (декей)
      delay.connect(echoWet).connect(this.ctx.destination)
    }
    return this.ctx
  }

  private tick(): void {
    const ctx = this.ctx
    const provider = this.provider
    if (!ctx || !provider || !this.master) return
    // Планировщик отстал (троттлинг setInterval в фоновой вкладке, тогда как currentTime идёт):
    // НЕ вываливаем просроченные лупы разом — иначе src.start(when<now) стартует их немедленно, все
    // сразу → наложение/каша (нарастает с каждым уходом в фон). Перескакиваем к настоящему времени.
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
    const ng = gain * (this.norm.get(stemId) ?? 1)   // громкость роли × нормализация стема
    const g = this.ctx.createGain()
    const p = g.gain
    const end = when + dur
    if (fade === 'out') {
      p.setValueCurveAtTime(equalPowerCurve(ng, 'out'), when, CROSSFADE_SEC)   // спад до 0, старт с 0
    } else {
      if (fade === 'in') p.setValueCurveAtTime(equalPowerCurve(ng, 'in'), when, CROSSFADE_SEC)
      else { p.setValueAtTime(0, when); p.linearRampToValueAtTime(ng, when + DECLICK_SEC) }  // 'none' — де-клик вход
      p.setValueAtTime(ng, end - DECLICK_SEC)   // де-клик выход в конце лупа (стем кончается не на нуле)
      p.linearRampToValueAtTime(0, end)
    }
    src.connect(g).connect(this.master)
    src.start(when)
    src.stop(end)
  }
}
