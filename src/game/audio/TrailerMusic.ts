import type { IMusicEngine, StemLibrary, Arrangement, StemRef } from './types'
import { STEM_LIBRARY } from './stems'

/**
 * Музыка трейлера: ДЕТЕРМИНИРОВАННАЯ (фиксированная, воспроизводимая) аранжировка, без рандома и без
 * fade-in (вступает сразу в полную силу — после обратного отсчёта). Прогрессия по лупам:
 *   луп 0 — кики + бас
 *   луп 1 — + лид 1
 *   луп 2 и далее — + лид 2
 * Стемы — те же, что в меню (та же палитра звука).
 */
const KICK_ID = 'kicks/sub_long'
const BASS_ID = 'bass/kutting'
const LEAD1_ID = 'lead/crickets_tex'
const LEAD2_ID = 'lead/lwt_14'
const KICK_GAIN = 1.25
const BASS_GAIN = 0.9
const LEAD_GAIN = 0.5

function trailerLibrary(): StemLibrary {
  const all: StemRef[] = Object.values(STEM_LIBRARY).flat()
  const pick = (id: string) => all.filter(s => s.id === id)
  return {
    kicks: pick(KICK_ID),
    bass: pick(BASS_ID),
    lead: [...pick(LEAD1_ID), ...pick(LEAD2_ID)],
    sfx: [],
  }
}

export class TrailerMusic {
  private readonly engine: IMusicEngine
  private readonly lib: StemLibrary
  private started = false

  constructor(engine: IMusicEngine) {
    this.engine = engine
    this.lib = trailerLibrary()
  }

  async preload(): Promise<void> { await this.engine.load(this.lib) }

  /** Старт без fade-in — сразу в полную (вызывать на «go» после отсчёта, из жеста). */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.engine.load(this.lib)
    await this.engine.start(i => this.arrange(i), 0)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.engine.fadeOut()
  }

  setVolume(v: number): void { this.engine.setMasterGain(v) }
  dispose(): void { this.engine.dispose() }

  /** Детерминированная прогрессия: кики+бас → +лид1 → +лид2 (и до конца). */
  arrange(loopIndex: number): Arrangement {
    const voices: Arrangement = [
      { role: 'kicks', stemId: KICK_ID, gain: KICK_GAIN },
      { role: 'bass', stemId: BASS_ID, gain: BASS_GAIN },
    ]
    if (loopIndex >= 1) voices.push({ role: 'lead', stemId: LEAD1_ID, gain: LEAD_GAIN })
    if (loopIndex >= 2) voices.push({ role: 'lead', stemId: LEAD2_ID, gain: LEAD_GAIN })
    return voices
  }
}
