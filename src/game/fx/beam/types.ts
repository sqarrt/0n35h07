import type * as THREE from 'three'

/**
 * Стратегия визуала луча выстрела (стилевая косметика, выбирается вместе с WindupStyle).
 * Владеет мешами луча/афтерглоу; на боёвку не влияет (все меши noRaycast, raycast боёвки
 * считает BeamWeapon отдельно). `play(start, end)` запускает анимацию выстрела,
 * `update(dt)` ведёт её до затухания, `reset()` мгновенно гасит (респаун/конец матча).
 */
export interface IBeamFx {
  readonly object3d: THREE.Object3D
  play(start: THREE.Vector3, end: THREE.Vector3): void
  update(dt: number): void
  reset(): void
  dispose(): void
}
