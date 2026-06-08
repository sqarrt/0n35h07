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
const COLOR_ON_LOOPS = 3     // сколько лупов слой держится включённым

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
  private colorOn: number[]   // по каждому цветному слою: оставшиеся лупы «включённости»

  constructor(engine: IMusicEngine, rng: () => number = Math.random) {
    this.engine = engine
    this.rng = rng
    this.lib = menuLibrary()
    this.colorOn = COLOR_IDS.map(() => 0)
  }

  /** Заводит музыку меню (идемпотентно). Должна вызываться из пользовательского жеста (autoplay). */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.engine.load(this.lib)
    await this.engine.start(i => this.arrange(i))
  }

  /** Плавно гасит (вход в матч/уход). Безопасно звать до старта. */
  stop(): void {
    if (!this.started) return
    this.started = false
    this.engine.fadeOut()
    this.colorOn = COLOR_IDS.map(() => 0)
  }

  setVolume(v: number): void { this.engine.setMasterGain(v) }
  dispose(): void { this.engine.dispose() }

  /** Аранжировка лупа: фундамент + независимо «дышащие» цветные слои. */
  arrange(_loopIndex: number): Arrangement {
    const voices: Arrangement = [
      { role: 'kicks', stemId: KICK_ID, gain: KICK_GAIN },
      { role: 'bass', stemId: BASS_ID, gain: BASS_GAIN },
    ]
    COLOR_IDS.forEach((id, i) => {
      if (this.stepColor(i)) voices.push({ role: 'lead', stemId: id, gain: COLOR_GAIN })
    })
    return voices
  }

  /** Состояние одного цветного слоя за луп: держим N лупов включённым, иначе иногда запускаем. */
  private stepColor(i: number): boolean {
    if (this.colorOn[i] > 0) { this.colorOn[i]--; return true }
    if (this.rng() < COLOR_ON_PROB) { this.colorOn[i] = COLOR_ON_LOOPS - 1; return true }
    return false
  }
}
