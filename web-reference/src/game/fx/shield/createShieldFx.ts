import type { ShieldStyle } from '../../../constants'
import type { IShieldFx } from './types'
import { DomeShieldFx } from './DomeShieldFx'
import { HexShieldFx } from './HexShieldFx'
import { CrystalShieldFx } from './CrystalShieldFx'

/** Shield skin factory (DOME/HEX/CRYSTAL). Color is not parameterized — the shield is always blue. */
export function createShieldFx(style: ShieldStyle): IShieldFx {
  switch (style) {
    case 'hex': return new HexShieldFx()
    case 'crystal': return new CrystalShieldFx()
    case 'dome': return new DomeShieldFx()
  }
}
