import type { IMusicEngine, StemLibrary, Arrangement, StemRef } from './types'
import { STEM_LIBRARY } from './stems'

// Стемы меню (id вида role/name из полной STEM_LIBRARY).
const KICK_ID = 'kicks/sub_long'
const BASS_ID = 'bass/kutting'
const COLOR_IDS = ['lead/crickets_tex', 'lead/lwt_14'] as const

const KICK_GAIN = 1.0
const BASS_GAIN = 0.9
const COLOR_GAIN = 0.5
const COLOR_ON_PROB = 0.25   // шанс за луп завести простаивающий цветной слой
const COLOR_ON_LOOPS = 2     // максимум лупов подряд для цветного слоя (не больше двух)
const COLOR_REST_LOOPS = 1   // обязательная пауза после он-окна (иначе слой мог бы тянуться >2 лупов)
const BASS_OFF_PROB = 0.25   // шанс за луп увести бас в паузу (в основном он звучит)
const BASS_OFF_LOOPS = 1     // сколько лупов бас отдыхает (один)
const BASS_PLAY_LOOPS = 1    // обязательная игра баса после паузы (паузы не слипаются)
const MENU_FADE_IN_SEC = 2.0 // плавное нарастание музыки меню на старте (не «сразу в полную силу»)

/** Минимальная библиотека: только нужные меню-стемы (по id из полной STEM_LIBRARY). */
function menuLibrary(): StemLibrary {
  const all: StemRef[] = Object.values(STEM_LIBRARY).flat()
  const pick = (id: string) => all.filter(s => s.id === id)
  return {
    kicks: pick(KICK_ID),
    bass: pick(BASS_ID),
    lead: COLOR_IDS.flatMap(id => pick(id)),
    sfx: [],
  }
}

/**
 * Фоновая музыка меню: фундамент (kick `sub_long` + bass `kutting`) каждый луп,
 * два цветных слоя (`crickets_tex`, `lwt_14`) включаются НЕЗАВИСИМО и иногда (могут вместе/никак).
 * Локальная (без сетевой синхронизации) → ГСЧ обычный; инъектируем для тестов.
 */
export class MenuMusic {
  private readonly engine: IMusicEngine
  private readonly lib: StemLibrary
  private readonly rng: () => number
  private started = false
  private colorOn: number[]    // по цветному слою: оставшиеся лупы он-окна
  private colorRest: number[]  // по цветному слою: оставшиеся лупы обязательной паузы после окна
  private bassRest = 0         // оставшиеся лупы паузы баса
  private bassPlay = 0         // оставшиеся лупы обязательной игры баса после паузы

  constructor(engine: IMusicEngine, rng: () => number = Math.random) {
    this.engine = engine
    this.rng = rng
    this.lib = menuLibrary()
    this.colorOn = COLOR_IDS.map(() => 0)
    this.colorRest = COLOR_IDS.map(() => 0)
  }

  /** Предзагрузка (декод) буферов — не требует жеста; делает первый старт по жесту мгновенным. */
  async preload(): Promise<void> {
    await this.engine.load(this.lib)
  }

  /** Заводит музыку меню (идемпотентно). Должна вызываться из пользовательского жеста (autoplay). */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.engine.load(this.lib)
    await this.engine.start(i => this.arrange(i), MENU_FADE_IN_SEC)
  }

  /** Плавно гасит (вход в матч/уход). Безопасно звать до старта. */
  stop(): void {
    if (!this.started) return
    this.started = false
    this.engine.fadeOut()
    this.colorOn = COLOR_IDS.map(() => 0)
    this.colorRest = COLOR_IDS.map(() => 0)
    this.bassRest = 0
    this.bassPlay = 0
  }

  setVolume(v: number): void { this.engine.setMasterGain(v) }
  /** Текущий RMS-уровень музыки меню 0..1 (для визуализации). */
  readLevel(): number { return this.engine.readLevel() }
  dispose(): void { this.engine.dispose() }

  /** Аранжировка лупа: кик (постоянный фундамент) + бас (в основном звучит, иногда пауза) +
   *  независимо «дышащие» цветные слои. */
  arrange(_loopIndex: number): Arrangement {
    const voices: Arrangement = [{ role: 'kicks', stemId: KICK_ID, gain: KICK_GAIN }]
    if (this.stepBass()) voices.push({ role: 'bass', stemId: BASS_ID, gain: BASS_GAIN })
    COLOR_IDS.forEach((id, i) => {
      if (this.stepColor(i)) voices.push({ role: 'lead', stemId: id, gain: COLOR_GAIN })
    })
    return voices
  }

  /** Цветной слой за луп: он-окно ≤ COLOR_ON_LOOPS, затем обязательная пауза (не тянется больше двух). */
  private stepColor(i: number): boolean {
    if (this.colorRest[i] > 0) { this.colorRest[i]--; return false }   // обязательная пауза после окна
    if (this.colorOn[i] > 0) { this.colorOn[i]--; if (this.colorOn[i] === 0) this.colorRest[i] = COLOR_REST_LOOPS; return true }
    if (this.rng() < COLOR_ON_PROB) {
      this.colorOn[i] = COLOR_ON_LOOPS - 1
      if (this.colorOn[i] === 0) this.colorRest[i] = COLOR_REST_LOOPS   // окно в 1 луп → сразу пауза
      return true
    }
    return false
  }

  /** Бас за луп: в основном звучит; иногда пауза на BASS_OFF_LOOPS, затем обязательная игра (паузы не слипаются). */
  private stepBass(): boolean {
    if (this.bassPlay > 0) { this.bassPlay--; return true }            // обязательная игра после паузы
    if (this.bassRest > 0) { this.bassRest--; if (this.bassRest === 0) this.bassPlay = BASS_PLAY_LOOPS; return false }
    if (this.rng() < BASS_OFF_PROB) {
      this.bassRest = BASS_OFF_LOOPS - 1
      if (this.bassRest === 0) this.bassPlay = BASS_PLAY_LOOPS         // пауза в 1 луп → сразу обязательная игра
      return false
    }
    return true
  }
}
