import type { WindupStyle } from '../../../constants'
import type { ISfxEngine, SfxEvent } from './types'

/** Звук зарядки по стилю анимации; нет ассета стиля → дефолтный beam_fire. */
const WINDUP_SFX: Record<WindupStyle, SfxEvent> = {
  classic: 'beam_fire',
  rage: 'beam_fire_rage',
  singularity: 'beam_fire_singularity',
}

/** Событие звука зарядки: маппинг по стилю + фоллбек на beam_fire, пока ассет не загружен. */
export function windupSfxEvent(style: WindupStyle | undefined, engine: ISfxEngine): SfxEvent {
  const ev = WINDUP_SFX[style ?? 'classic']
  return engine.has(ev) ? ev : 'beam_fire'
}
