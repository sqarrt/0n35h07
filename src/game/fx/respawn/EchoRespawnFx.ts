import * as THREE from 'three'
import { GHOST_OPACITY, SPAWN_ANIM_MS, SPAWN_POP, BODY_MESH_Y } from '../../../constants'
import { DeathBurst } from '../DeathBurst'
import { AfterimageTrail } from '../AfterimageTrail'
import type { IRespawnFx, RespawnTarget, RespawnFrame } from './types'

/** «Эхо» — базовый стиль: хлопок частиц на смерти, полупрозрачный призрак, упругий «пуф» материализации.
 *  Поведение перенесено из Player (DeathBurst + GHOST_OPACITY + lifecycleVisual) бит-в-бит.
 *  След призрака — СОБСТВЕННЫЙ классический AfterimageTrail (каждая стратегия владеет своим). */
export class EchoRespawnFx implements IRespawnFx {
  readonly object3d = new THREE.Group()
  private burst: DeathBurst
  private ghostTrail: AfterimageTrail
  private trailEye = new THREE.Vector3()   // scratch: AfterimageTrail ждёт позицию ГЛАЗ, origin — центр шара

  constructor(color: string) {
    this.burst = new DeathBurst(new THREE.Color(color))
    this.ghostTrail = new AfterimageTrail(new THREE.Color(color))
    this.object3d.add(this.burst.object3d, this.ghostTrail.object3d)
  }

  onDeath(pos: THREE.Vector3): void { this.burst.emit(pos) }

  apply(dt: number, t: RespawnTarget, f: RespawnFrame): void {
    // Собственный след призрака (трейл сам смещает позицию глаз к центру шара).
    this.trailEye.copy(f.origin)
    this.trailEye.y -= BODY_MESH_Y
    this.ghostTrail.update(dt, { position: this.trailEye, dashing: f.ghost !== null && f.visible })

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

  dispose(): void {
    this.burst.dispose()
    this.ghostTrail.dispose()
  }
}
