import type { WindupStyle } from '../../../constants'
import type { IWindupFx } from './types'
import { ClassicWindupFx } from './ClassicWindupFx'
import { RageWindupFx } from './RageWindupFx'
import { SingularityWindupFx } from './SingularityWindupFx'

/** Фабрика стратегии анимации заряда по выбранному стилю (boundary для Match и превью меню). */
export function createWindupFx(style: WindupStyle): IWindupFx {
  switch (style) {
    case 'rage':        return new RageWindupFx()
    case 'singularity': return new SingularityWindupFx()
    case 'classic':     return new ClassicWindupFx()
  }
}
