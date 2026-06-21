import type { WindupStyle } from '../../../constants'
import type { IBeamFx } from './types'
import { ClassicBeamFx } from './ClassicBeamFx'
import { RageBeamFx } from './RageBeamFx'
import { SingularityBeamFx } from './SingularityBeamFx'

/** Beam visual factory by shot style: the shape is style-specific, the shell color is the player color. */
export function createBeamFx(style: WindupStyle, playerColor: string): IBeamFx {
  switch (style) {
    case 'rage':        return new RageBeamFx(playerColor)
    case 'singularity': return new SingularityBeamFx(playerColor)
    case 'classic':     return new ClassicBeamFx('white', playerColor)
  }
}
