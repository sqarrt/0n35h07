import * as THREE from 'three'
import { WINDUP_SCALE_GAIN, BOT_COLOR_WHITE } from '../../../constants'
import type { IWindupFx, WindupTarget, WindupFrame } from './types'

/** Дефолтная анимация: раздув + уход цвета в белый во время заряда, плавное сдувание после выстрела. */
export class ClassicWindupFx implements IWindupFx {
  readonly object3d = new THREE.Group()   // world-space части нет
  private white = new THREE.Color(BOT_COLOR_WHITE)

  apply(_dt: number, t: WindupTarget, f: WindupFrame): void {
    if (f.progress > 0) {
      t.mesh.scale.setScalar(1 + f.progress * WINDUP_SCALE_GAIN)
      t.material.color.lerpColors(f.baseColor, this.white, f.progress)
    } else if (f.shrink < 1) {
      t.mesh.scale.setScalar(1 + WINDUP_SCALE_GAIN * (1 - f.shrink))
      t.material.color.copy(f.baseColor)
    } else {
      t.mesh.scale.setScalar(1)
      t.material.color.copy(f.baseColor)
    }
    // Гасим emissive всегда: после переключения с rage в превью не должно остаться свечение.
    t.material.emissive.setScalar(0)
  }

  dispose(): void {}
}
