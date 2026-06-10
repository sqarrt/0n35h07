import * as THREE from 'three'
import { BEAM_DURATION } from '../../../constants'
import type { IBeamFx } from './types'

// «Гравитационная нить»: тёмное ядро + спираль частиц цвета игрока, втягивающаяся обратно в стрелка.
const CORE_RADIUS = 0.03         // тонкая тёмная нить
const CORE_COLOR = '#05050d'     // почти чёрный (как SING_DARK у вихря зарядки)
const CORE_OPACITY = 0.95        // обычный блендинг: тёмное ядро ДОЛЖНО перекрывать фон (additive не виден)
const SHELL_RADIUS = 0.09        // слабая оболочка цвета игрока вокруг нити
const SHELL_OPACITY = 0.25
const SPIRAL_PARTICLES = 64
const SPIRAL_RADIUS = 0.35       // радиус навивки в начале жизни луча
const SPIRAL_SHRINK = 0.6        // насколько радиус навивки сжимается к концу жизни (доля)
const TURNS_PER_UNIT = 0.7       // витков спирали на единицу длины луча
const PHASE_SPEED = 2.5          // прогонов фазы в секунду (бег частиц от дула к цели — «всасывание»)
const SPIRAL_SIZE = 0.07         // размер частицы
const SPIRAL_OPACITY = 0.9
const RETRACT_START_FRAC = 0.35  // доля жизни, после которой нить начинает втягиваться к дулу
const CYL_SEGMENTS = 6
const UP = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
const TWO_PI = Math.PI * 2

/** Луч стиля singularity: тёмная нить в оболочке цвета игрока + спираль частиц; гаснет втягиванием в дуло. */
export class SingularityBeamFx implements IBeamFx {
  readonly object3d = new THREE.Group()
  private core: THREE.Mesh
  private coreMat: THREE.MeshBasicMaterial
  private shell: THREE.Mesh
  private shellMat: THREE.MeshBasicMaterial
  private points: THREE.Points
  private pmat: THREE.PointsMaterial
  private positions: Float32Array

  private active = false
  private elapsed = 0          // мс с момента выстрела
  private time = 0             // локальное время (бег фазы спирали)
  private start = new THREE.Vector3()
  private quat = new THREE.Quaternion()
  private dirN = new THREE.Vector3()
  private side1 = new THREE.Vector3()
  private side2 = new THREE.Vector3()
  private scratch = new THREE.Vector3()
  private len = 0

  constructor(playerColor: string) {
    this.coreMat = new THREE.MeshBasicMaterial({ color: CORE_COLOR, transparent: true, opacity: CORE_OPACITY })
    this.core = new THREE.Mesh(new THREE.CylinderGeometry(CORE_RADIUS, CORE_RADIUS, 1, CYL_SEGMENTS), this.coreMat)
    this.core.userData.noRaycast = true
    this.core.visible = false
    this.shellMat = new THREE.MeshBasicMaterial({
      color: playerColor, transparent: true, opacity: SHELL_OPACITY,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    this.shell = new THREE.Mesh(new THREE.CylinderGeometry(SHELL_RADIUS, SHELL_RADIUS, 1, CYL_SEGMENTS), this.shellMat)
    this.shell.userData.noRaycast = true
    this.shell.visible = false

    this.positions = new Float32Array(SPIRAL_PARTICLES * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.pmat = new THREE.PointsMaterial({
      color: playerColor, size: SPIRAL_SIZE, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
    this.points = new THREE.Points(geo, this.pmat)
    this.points.userData.noRaycast = true
    this.points.visible = false

    this.object3d.add(this.core, this.shell, this.points)   // children[0] — ядро-нить (см. тесты)
  }

  play(start: THREE.Vector3, end: THREE.Vector3): void {
    this.start.copy(start)
    this.dirN.copy(end).sub(start)
    this.len = this.dirN.length()
    if (this.len < 1e-6) return
    this.dirN.divideScalar(this.len)
    this.quat.setFromUnitVectors(UP, this.dirN)
    this.side1.crossVectors(this.dirN, UP)
    if (this.side1.lengthSq() < 1e-8) this.side1.copy(X_AXIS)
    this.side1.normalize()
    this.side2.crossVectors(this.dirN, this.side1).normalize()
    this.active = true
    this.elapsed = 0
  }

  update(dt: number): void {
    this.time += dt
    if (!this.active) return
    this.elapsed += dt * 1000
    const t = this.elapsed / BEAM_DURATION
    if (t >= 1) { this.hide(); return }

    // Втягивание: после RETRACT_START_FRAC видимая длина сокращается от цели к дулу.
    const retract = t <= RETRACT_START_FRAC ? 0 : (t - RETRACT_START_FRAC) / (1 - RETRACT_START_FRAC)
    const visibleLen = this.len * (1 - retract)

    // Нить + оболочка: от дула на видимую длину.
    this.scratch.copy(this.start).addScaledVector(this.dirN, visibleLen / 2)
    this.core.position.copy(this.scratch)
    this.core.quaternion.copy(this.quat)
    this.core.scale.set(1, visibleLen, 1)
    this.core.visible = true
    this.shell.position.copy(this.scratch)
    this.shell.quaternion.copy(this.quat)
    this.shell.scale.set(1, visibleLen, 1)
    this.shell.visible = true

    // Спираль: частицы навиты вдоль видимой части, фаза бежит от дула к цели, навивка сжимается.
    const phase = (this.time * PHASE_SPEED) % 1
    const r = SPIRAL_RADIUS * (1 - SPIRAL_SHRINK * t)
    for (let i = 0; i < SPIRAL_PARTICLES; i++) {
      const u = ((i / SPIRAL_PARTICLES + phase) % 1) * visibleLen   // позиция вдоль оси
      const a = u * TURNS_PER_UNIT * TWO_PI
      this.positions[i * 3]     = this.start.x + this.dirN.x * u + this.side1.x * Math.cos(a) * r + this.side2.x * Math.sin(a) * r
      this.positions[i * 3 + 1] = this.start.y + this.dirN.y * u + this.side1.y * Math.cos(a) * r + this.side2.y * Math.sin(a) * r
      this.positions[i * 3 + 2] = this.start.z + this.dirN.z * u + this.side1.z * Math.cos(a) * r + this.side2.z * Math.sin(a) * r
    }
    ;(this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    this.pmat.opacity = SPIRAL_OPACITY * (1 - retract)   // спираль гаснет вместе с втягиванием
    this.points.visible = true
  }

  private hide() {
    this.active = false
    this.core.visible = false
    this.shell.visible = false
    this.points.visible = false
    this.pmat.opacity = 0
  }

  reset(): void { this.hide() }

  dispose(): void {
    this.core.geometry.dispose()
    this.coreMat.dispose()
    this.shell.geometry.dispose()
    this.shellMat.dispose()
    this.points.geometry.dispose()
    this.pmat.dispose()
  }
}
