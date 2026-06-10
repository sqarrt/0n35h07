import type { ShieldStyle } from '../../../constants'
import type { IShieldFx } from './types'
import { DomeShieldFx } from './DomeShieldFx'
import { GyroShieldFx } from './GyroShieldFx'
import { CrystalShieldFx } from './CrystalShieldFx'

/** Фабрика скина щита (КУПОЛ/ОРБИТЫ/КРИСТАЛЛ). Цвет не параметризуется — щит всегда синий. */
export function createShieldFx(style: ShieldStyle): IShieldFx {
  switch (style) {
    case 'gyro': return new GyroShieldFx()
    case 'crystal': return new CrystalShieldFx()
    case 'dome': return new DomeShieldFx()
  }
}
