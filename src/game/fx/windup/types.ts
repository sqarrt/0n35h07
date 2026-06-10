import type * as THREE from 'three'

/** Цель анимации заряда: меш шара + материал (боевой Body или превью в меню). */
export interface WindupTarget {
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
}

/**
 * Кадровое состояние заряда (собирает владелец: Player или превью).
 * `origin`/`aimDir` — в системе координат РОДИТЕЛЯ object3d (в матче родитель — match.root → мир;
 * в превью object3d — ребёнок масштабируемой группы шара → локальные координаты группы).
 */
export interface WindupFrame {
  progress: number       // 0..1 заряд (0 — заряда нет)
  shrink: number         // 0..1 прогресс «сдувания» после выстрела (1 — закончено/неактуально)
  baseColor: THREE.Color // базовый цвет шара
  aimDir: THREE.Vector3  // направление взгляда (ориентация world-space части)
  origin: THREE.Vector3  // позиция центра шара
  visible: boolean       // false — world-space часть скрыть (FP: свой игрок не виден)
}

/**
 * Стратегия анимации подготовки выстрела. В фазах заряда/сдувания владеет mesh.scale,
 * material.color и material.emissive цели и обязана вернуть их к базе в нейтральном кадре
 * (progress=0, shrink=1). material.opacity НЕ трогает (им владеют призрак/фейды).
 */
export interface IWindupFx {
  readonly object3d: THREE.Object3D   // world-space часть (челюсти/вихрь); пустая Group у classic
  apply(dt: number, target: WindupTarget, frame: WindupFrame): void
  dispose(): void
}
