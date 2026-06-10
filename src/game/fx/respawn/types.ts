import type * as THREE from 'three'

/** Цель анимации респавна: меш шара + материал + установка прозрачности
 *  (у Body setOpacity красит сферу+кольцо планеты; превью передаёт свой аналог). */
export interface RespawnTarget {
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  setOpacity(o: number): void
}

/**
 * Кадровое состояние респавна (собирает владелец: Player или превью).
 * `origin` — центр шара в координатах РОДИТЕЛЯ object3d (матч: match.root/мир; превью: группа шара).
 */
export interface RespawnFrame {
  ghost: number | null     // фаза призрака: остаток 1→0; null — не призрак
  sinceRebirthMs: number   // мс с последней материализации (включая первый спавн)
  baseColor: THREE.Color
  origin: THREE.Vector3
  visible: boolean         // false (FP: свой игрок) — world-часть и меш-эффекты скрыть
}

/**
 * Стратегия анимации респавна. В фазе призрака и в окне возрождения (своя длительность,
 * см. isRebirthActive) владеет mesh.scale, mesh.visible, material.color и прозрачностью
 * (target.setOpacity); на первом apply вне своих фаз обязана вернуть нейтраль
 * (mesh.visible = f.visible, смещения меша = 0) и спрятать world-часть; дальше — no-op
 * (визуалом владеют windup/прочие, прозрачность ставит Player).
 */
export interface IRespawnFx {
  readonly object3d: THREE.Object3D     // world-часть (осколки/частицы) — живёт в match.root
  onDeath(pos: THREE.Vector3): void     // момент смерти (хлопок/разрыв/рассыпание)
  apply(dt: number, target: RespawnTarget, f: RespawnFrame): void
  /** Окно возрождения ещё активно? (Player прячет щит на это время — как прежний «пуф».) */
  isRebirthActive(sinceRebirthMs: number): boolean
  update(dt: number): void              // тик частиц (живут и вне фаз, как DeathBurst)
  dispose(): void
}
