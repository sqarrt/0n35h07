import * as THREE from 'three'
import type { IRespawnFx, RespawnTarget, RespawnFrame } from './types'

// «Рой»: шар рассыпается на осколки; призрак — рой кружит вокруг игрока; возрождение — слетается.
const FRAGMENTS = 30
const FRAG_SIZE = 0.09             // размер осколка (тетраэдр)
const SCATTER_MS = 350             // разлёт после смерти, потом орбиты
const SCATTER_SPEED = 5            // начальная скорость разлёта
const ORBIT_R_MIN = 0.5            // радиусы орбит роя
const ORBIT_R_MAX = 1.3
const ORBIT_SPEED_MIN = 1.6        // угловые скорости (рад/с)
const ORBIT_SPEED_MAX = 3.4
const ORBIT_CAPTURE = 0.25         // сила захвата на орбиту после разлёта (lerp/кадр)
const ORBIT_CAPTURE_MIN = 0.02     // минимальный захват во время разлёта
const BOB_AMP = 0.35               // вертикальное колыхание
const BOB_HZ = 0.9
const FOLLOW_LERP = 0.12           // как быстро центр роя догоняет origin (на кадр)
const GATHER_MS = 450              // окно возрождения: рой слетается в точку
const GATHER_LERP_BASE = 0.05      // базовая скорость слёта + рост с прогрессом
const GATHER_LERP_GAIN = 0.35
const REBIRTH_SCALE_FROM = 0.5     // шар «разгорается» от этого масштаба к 1
const SPIN_Y_FRAC = 0.7            // вращение осколка по Y — доля от X (хаотичный кувырок)
// Собственный след роя: угасающие клоны-осколки по траектории (вместо общего шар-следа).
const TRAIL_CLONES = 24
const TRAIL_INTERVAL_MS = 28       // частота эмита клона (след плотный, но дешёвый)
const TRAIL_LIFE_MS = 320
const TRAIL_OPACITY = 0.5
const TWO_PI = Math.PI * 2

/** Стиль «рой»: вместо полупрозрачного призрака — кружащие осколки цвета игрока. */
export class SwarmRespawnFx implements IRespawnFx {
  readonly object3d = new THREE.Group()
  readonly ownGhostTrail = true   // след рисуют сами осколки (шар-след выглядел бы чужеродно — шар скрыт)
  private frags: THREE.Mesh[] = []
  private mat: THREE.MeshBasicMaterial
  private geo: THREE.TetrahedronGeometry
  private trailClones: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number }[] = []
  private trailTimer = 0
  private trailNext = 0           // индекс следующего клона в пуле (кольцевой)
  private angles: Float32Array      // фаза орбиты
  private radii: Float32Array
  private speeds: Float32Array
  private heights: Float32Array     // фазовый сдвиг колыхания
  private scatterVel: THREE.Vector3[] = []
  private sinceDeathMs = Infinity
  private center = new THREE.Vector3()   // демпфированный центр роя (догоняет origin)
  private centerInit = false
  private time = 0
  private dirty = false
  private orbitScratch = new THREE.Vector3()   // точка орбиты (без аллокаций в кадре)

  constructor(color: string) {
    this.mat = new THREE.MeshBasicMaterial({ color })
    this.geo = new THREE.TetrahedronGeometry(FRAG_SIZE)
    this.angles = new Float32Array(FRAGMENTS)
    this.radii = new Float32Array(FRAGMENTS)
    this.speeds = new Float32Array(FRAGMENTS)
    this.heights = new Float32Array(FRAGMENTS)
    for (let i = 0; i < FRAGMENTS; i++) {
      const m = new THREE.Mesh(this.geo, this.mat)
      m.userData.noRaycast = true
      this.object3d.add(m)
      this.frags.push(m)
      this.scatterVel.push(new THREE.Vector3())
      this.angles[i] = Math.random() * TWO_PI
      this.radii[i] = ORBIT_R_MIN + Math.random() * (ORBIT_R_MAX - ORBIT_R_MIN)
      this.speeds[i] = ORBIT_SPEED_MIN + Math.random() * (ORBIT_SPEED_MAX - ORBIT_SPEED_MIN)
      this.heights[i] = Math.random() * TWO_PI
    }
    for (let i = 0; i < TRAIL_CLONES; i++) {   // пул следа: индивидуальная прозрачность → свой материал
      const cmat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
      const clone = new THREE.Mesh(this.geo, cmat)
      clone.userData.noRaycast = true
      clone.visible = false
      this.object3d.add(clone)
      this.trailClones.push({ mesh: clone, mat: cmat, life: 0 })
    }
    this.object3d.visible = false
  }

  onDeath(pos: THREE.Vector3): void {
    this.sinceDeathMs = 0
    this.center.copy(pos)
    this.centerInit = true
    for (let i = 0; i < FRAGMENTS; i++) {
      this.frags[i].position.copy(pos)
      this.scatterVel[i].set((Math.random() - 0.5) * 2, Math.random() - 0.2, (Math.random() - 0.5) * 2)
        .normalize().multiplyScalar(SCATTER_SPEED * (0.5 + Math.random() * 0.5))
    }
  }

  apply(dt: number, t: RespawnTarget, f: RespawnFrame): void {
    this.time += dt
    if (f.ghost !== null) {
      if (!this.centerInit) { this.center.copy(f.origin); this.centerInit = true }
      t.mesh.visible = false                                    // шар скрыт — игрока обозначает рой
      this.object3d.visible = f.visible
      this.center.lerp(f.origin, FOLLOW_LERP)                   // рой догоняет движущегося призрака
      this.sinceDeathMs += dt * 1000
      const orbitK = Math.min(this.sinceDeathMs / SCATTER_MS, 1)   // 0 — разлёт, 1 — чистая орбита
      for (let i = 0; i < FRAGMENTS; i++) {
        const m = this.frags[i]
        if (orbitK < 1) m.position.addScaledVector(this.scatterVel[i], dt * (1 - orbitK))
        this.angles[i] += this.speeds[i] * dt
        this.orbitPoint(i, this.radii[i])
        m.position.lerp(this.orbitScratch, Math.max(orbitK * ORBIT_CAPTURE, ORBIT_CAPTURE_MIN))   // плавный захват
        m.rotation.x += dt * this.speeds[i]; m.rotation.y += dt * this.speeds[i] * SPIN_Y_FRAC
      }
      this.stepTrail(dt)   // собственный след: угасающие клоны по траектории осколков
      this.dirty = true
      return
    }
    if (this.isRebirthActive(f.sinceRebirthMs)) {
      const k = f.sinceRebirthMs / GATHER_MS                    // 0→1: рой слетается, шар разгорается
      this.object3d.visible = f.visible && k < 1
      for (let i = 0; i < FRAGMENTS; i++) this.frags[i].position.lerp(f.origin, Math.min(1, k * GATHER_LERP_GAIN + GATHER_LERP_BASE))
      t.mesh.visible = f.visible
      t.mesh.scale.setScalar(REBIRTH_SCALE_FROM + (1 - REBIRTH_SCALE_FROM) * k)
      t.setOpacity(1)
      t.material.color.copy(f.baseColor)
      this.dirty = true
      return
    }
    if (this.dirty) {                                           // первый кадр вне фаз — нейтраль
      t.mesh.visible = f.visible
      t.setOpacity(1)
      this.object3d.visible = false
      this.sinceDeathMs = Infinity
      this.centerInit = false
      this.dirty = false
    }
  }

  /** Эмит следа: каждые TRAIL_INTERVAL_MS — клон в позиции случайного осколка (угасание — в update). */
  private stepTrail(dt: number) {
    this.trailTimer -= dt * 1000
    if (this.trailTimer > 0) return
    this.trailTimer = TRAIL_INTERVAL_MS
    const src = this.frags[Math.floor(Math.random() * FRAGMENTS)]
    const c = this.trailClones[this.trailNext]
    this.trailNext = (this.trailNext + 1) % TRAIL_CLONES
    c.mesh.position.copy(src.position)
    c.mesh.rotation.copy(src.rotation)
    c.life = TRAIL_LIFE_MS
    c.mesh.visible = true
  }

  /** Точка орбиты осколка вокруг демпфированного центра роя → orbitScratch. */
  private orbitPoint(i: number, r: number): void {
    this.orbitScratch.set(
      this.center.x + Math.cos(this.angles[i]) * r,
      this.center.y + Math.sin(this.time * BOB_HZ * TWO_PI + this.heights[i]) * BOB_AMP,
      this.center.z + Math.sin(this.angles[i]) * r,
    )
  }

  isRebirthActive(sinceRebirthMs: number): boolean {
    return sinceRebirthMs >= 0 && sinceRebirthMs < GATHER_MS
  }

  /** Угасание клонов следа — и вне фаз (хвост дотлевает после выхода из призрака). */
  update(dt: number): void {
    for (const c of this.trailClones) {
      if (c.life <= 0) continue
      c.life -= dt * 1000
      if (c.life <= 0) { c.mesh.visible = false; c.mat.opacity = 0; continue }
      c.mat.opacity = TRAIL_OPACITY * (c.life / TRAIL_LIFE_MS)
    }
  }

  dispose(): void {
    this.geo.dispose()
    this.mat.dispose()
    this.trailClones.forEach(c => c.mat.dispose())
  }
}
