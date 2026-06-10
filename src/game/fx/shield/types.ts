import * as THREE from 'three'

/**
 * Визуал щита (скин). object3d добавляется РЕБЁНКОМ в Shield.object3d — видимостью группы
 * управляют Shield/Player как раньше (включая форс видимости удалённого игрока из снапшота).
 * update тикает анимацию; active=true в активной фазе ЛИБО когда группа видима извне
 * (удалённый игрок) — анимация скина не замирает.
 */
export interface IShieldFx {
  readonly object3d: THREE.Object3D
  update(dt: number, active: boolean): void
  dispose(): void
}
