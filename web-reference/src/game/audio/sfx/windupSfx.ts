import type { WindupStyle } from '../../../constants'
import type { ISfxEngine, SfxEvent } from './types'

/** Windup sound by animation style; no style asset → default beam_fire. */
const WINDUP_SFX: Record<WindupStyle, SfxEvent> = {
  classic: 'beam_fire',
  rage: 'beam_fire_rage',
  singularity: 'beam_fire_singularity',
}

/** Windup sound event: mapping by style + fallback to beam_fire while asset isn't loaded. */
export function windupSfxEvent(style: WindupStyle | undefined, engine: ISfxEngine): SfxEvent {
  const ev = WINDUP_SFX[style ?? 'classic']
  return engine.has(ev) ? ev : 'beam_fire'
}
