import * as THREE from 'three'
import { GHOST_OPACITY, SPAWN_ANIM_MS, SPAWN_POP } from '../../../constants'
import { DeathBurst } from '../DeathBurst'
import type { IRespawnFx, RespawnTarget, RespawnFrame } from './types'

/** «Эхо» — базовый стиль: хлопок частиц на смерти, полупрозрачный призрак, упругий «пуф» материализации.
 *  Поведение перенесено из Player (DeathBurst + GHOST_OPACITY + lifecycleVisual) бит-в-бит. */
export class EchoRespawnFx implements IRespawnFx {
  readonly object3d: THREE.Object3D
  readonly ownGhostTrail = false   // след призрака — общий AfterimageTrail
  private burst: DeathBurst

  constructor(color: string) {
    this.burst = new DeathBurst(new THREE.Color(color))
    this.object3d = this.burst.object3d
  }

  onDeath(pos: THREE.Vector3): void { this.burst.emit(pos) }

  apply(_dt: number, t: RespawnTarget, f: RespawnFrame): void {
    if (f.ghost !== null) {            // призрак: полупрозрачный, без следов масштаба заряда
      t.mesh.scale.setScalar(1)
      t.setOpacity(GHOST_OPACITY)
      t.material.color.copy(f.baseColor)
      return
    }
    const st = f.sinceRebirthMs / SPAWN_ANIM_MS
    if (st >= 0 && st < 1) {           // «пуф»: упругий всплеск масштаба поверх windup
      t.mesh.scale.setScalar(1 + SPAWN_POP * Math.sin(Math.PI * st))
      t.setOpacity(1)
      t.material.color.copy(f.baseColor)
    }
    // обычный кадр — no-op
  }

  isRebirthActive(sinceRebirthMs: number): boolean {
    return sinceRebirthMs >= 0 && sinceRebirthMs < SPAWN_ANIM_MS
  }

  update(dt: number): void { this.burst.update(dt) }
  dispose(): void { this.burst.dispose() }
}
