import type { WindupStyle } from '../../../constants'
import type { IWindupFx } from './types'
import { ClassicWindupFx } from './ClassicWindupFx'
import { RageWindupFx } from './RageWindupFx'
import { SingularityWindupFx } from './SingularityWindupFx'

/** Factory for the charge animation strategy by selected style (boundary for Match and menu preview). */
export function createWindupFx(style: WindupStyle): IWindupFx {
  switch (style) {
    case 'rage':        return new RageWindupFx()
    case 'singularity': return new SingularityWindupFx()
    case 'classic':     return new ClassicWindupFx()
  }
}
