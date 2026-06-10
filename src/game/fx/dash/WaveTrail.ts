import * as THREE from 'three'
import type { IDashTrail, DashTrailContext } from '../../abstractions'
import { BODY_MESH_Y } from '../../../constants'

// ВОЛНА: рывок оставляет на пути кольца-ударные волны (плоскость поперёк движения),
// кольца расширяются и гаснут. Чистая косметика, цвет игрока.
const WAVE_INTERVAL_MS = 25    // мс между кольцами (плотный частокол волн)
const WAVE_LIFE_MS     = 450   // мс жизни кольца
const WAVE_POOL        = 20    // размер пула
const WAVE_INNER       = 0.3   // стартовый внутренний радиус кольца
const WAVE_OUTER       = 0.38  // стартовый внешний радиус кольца
const WAVE_SEGMENTS    = 24
const WAVE_GROW        = 3.5   // ед/с — скорость роста масштаба
const WAVE_OPACITY     = 0.7   // стартовая непрозрачность

const RING_NORMAL = new THREE.Vector3(0, 0, 1)   // нормаль RingGeometry по умолчанию

interface Wave {
  mesh:    THREE.Mesh
  mat:     THREE.MeshBasicMaterial
  life:    number   // оставшаяся жизнь, мс
}

export class WaveTrail implements IDashTrail {
  readonly object3d = new THREE.Group()
  private geometry: THREE.RingGeometry
  private waves: Wave[] = []
  private offset = new THREE.Vector3(0, BODY_MESH_Y, 0)   // центр тела относительно глаз
  private emitTimer = 0
  private lastPos = new THREE.Vector3()
  private hasLastPos = false
  private dir = new THREE.Vector3(1, 0, 0)   // последнее валидное направление движения

  constructor(color: string) {
    this.geometry = new THREE.RingGeometry(WAVE_INNER, WAVE_OUTER, WAVE_SEGMENTS)
    for (let i = 0; i < WAVE_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(this.geometry, mat)
      mesh.visible = false
      mesh.userData.noRaycast = true
      this.object3d.add(mesh)
      this.waves.push({ mesh, mat, life: 0 })
    }
  }

  update(dt: number, ctx: DashTrailContext) {
    const ms = dt * 1000
    if (ctx.dashing) {
      // Направление — по дельте позиций (вырожденная дельта → прежнее направление).
      if (this.hasLastPos) {
        const delta = ctx.position.clone().sub(this.lastPos)
        if (delta.lengthSq() > 1e-8) this.dir.copy(delta.normalize())
      }
      this.emitTimer -= ms
      if (this.emitTimer <= 0) {
        this.emitTimer = WAVE_INTERVAL_MS
        this.emit(ctx.position)
      }
    } else {
      this.emitTimer = 0
      this.hasLastPos = false
    }
    this.lastPos.copy(ctx.position)
    if (ctx.dashing) this.hasLastPos = true

    for (const w of this.waves) {
      if (w.life <= 0) continue
      w.life -= ms
      if (w.life <= 0) { w.mesh.visible = false; w.mat.opacity = 0; continue }
      const t = w.life / WAVE_LIFE_MS                    // 1 → 0
      const age = (WAVE_LIFE_MS - w.life) / 1000         // сек с эмита
      w.mat.opacity = WAVE_OPACITY * t
      w.mesh.scale.setScalar(1 + WAVE_GROW * age)
    }
  }

  private emit(eyePos: THREE.Vector3) {
    const w = this.waves.find(x => x.life <= 0)
    if (!w) return   // пул исчерпан — пропускаем (визуальная мелочь)
    w.mesh.position.copy(eyePos).add(this.offset)
    w.mesh.quaternion.setFromUnitVectors(RING_NORMAL, this.dir)   // плоскость кольца поперёк движения
    w.mesh.scale.setScalar(1)
    w.mesh.visible = true
    w.mat.opacity = WAVE_OPACITY
    w.life = WAVE_LIFE_MS
  }

  get aliveCount() { return this.waves.reduce((n, w) => n + (w.life > 0 ? 1 : 0), 0) }

  dispose() {
    this.geometry.dispose()
    this.waves.forEach(w => w.mat.dispose())
  }
}
