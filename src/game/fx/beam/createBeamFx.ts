import type { WindupStyle } from '../../../constants'
import type { IBeamFx } from './types'
import { ClassicBeamFx } from './ClassicBeamFx'
import { RageBeamFx } from './RageBeamFx'
import { SingularityBeamFx } from './SingularityBeamFx'

/** Фабрика визуала луча по стилю выстрела: форма стилевая, цвет оболочки — цвет игрока. */
export function createBeamFx(style: WindupStyle, playerColor: string): IBeamFx {
  switch (style) {
    case 'rage':        return new RageBeamFx(playerColor)
    case 'singularity': return new SingularityBeamFx(playerColor)
    case 'classic':     return new ClassicBeamFx('white', playerColor)
  }
}
