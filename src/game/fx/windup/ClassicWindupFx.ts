import * as THREE from 'three'
import { WINDUP_SCALE_GAIN, BOT_COLOR_WHITE } from '../../../constants'
import type { IWindupFx, WindupTarget, WindupFrame } from './types'

/** Default animation: swell + color shift to white during charge, smooth deflation after firing. */
export class ClassicWindupFx implements IWindupFx {
  readonly object3d = new THREE.Group()   // no world-space part
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
    // Always clear emissive: after switching from rage, the preview must not keep any glow.
    t.material.emissive.setScalar(0)
  }

  dispose(): void {}
}
