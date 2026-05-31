import * as THREE from 'three'
import type { World } from './World'

/** То, чем управляет ЛЮБОЙ контроллер (клавиатура человека или ИИ бота). */
export interface IControllable {
  moveIntent(worldDir: THREE.Vector3, dt: number): void
  jump(): void
  aim(dir: THREE.Vector3): void
  startFiring(): void
  activateShield(): void
}

export interface WeaponContext {
  world:      World
  muzzle:     THREE.Vector3
  aim:        THREE.Vector3
  excludeIds: number[]
}

export interface FireOutcome {
  end:         THREE.Vector3
  hitEntityId: number | null
  hitPoint:    THREE.Vector3 | null
}

export interface IWeapon {
  beginWindup(): void
  update(dt: number, ctx: WeaponContext): void
  reset(): void
  spawnImpact(point: THREE.Vector3): void
  readonly object3d:        THREE.Object3D
  readonly isWindingUp:     boolean
  readonly windupProgress:  number   // 0..1
  cooldownProgress():       number   // 1 = готов
  readonly justFired:       boolean
  readonly outcome:         FireOutcome | null
  clearJustFired(): void
  dispose(): void
}

export interface IShield {
  activate(): void
  update(dt: number): void
  reset(): void
  readonly object3d:  THREE.Object3D
  readonly isActive:  boolean
  progress():         number   // 1 = готов
  dispose(): void
}

/** Контроллер двигает один IControllable каждый кадр. */
export interface Controller {
  update(dt: number): void
  /** Вызывается ПОСЛЕ физики всех игроков (нужно для постановки камеры). */
  lateUpdate?(dt: number): void
}
