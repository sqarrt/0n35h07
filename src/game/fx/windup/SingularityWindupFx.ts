import * as THREE from 'three'
import { BALL_RADIUS } from '../../../constants'
import type { IWindupFx, WindupTarget, WindupFrame } from './types'

// --- Шар: сжатие + потемнение (инверсия дефолта). ---
const SING_SHRINK = 0.35              // максимальное сжатие (доля масштаба) к пику заряда
const SING_DARK = '#05050d'           // почти чёрный с холодным оттенком

// --- Аккреционный вихрь: частицы по спирали всасываются в шар. ---
const SING_PARTICLES = 48
const SING_R_MAX = BALL_RADIUS * 3.2  // радиус появления частиц
const SING_R_MIN = BALL_RADIUS * 0.7  // радиус поглощения (внутри шара)
const SING_SPIN_MIN = 2.4             // угловая скорость (рад/с) в начале заряда
const SING_SPIN_GAIN = 3.2            // прибавка к пику
const SING_PULL = 1.4                 // скорость всасывания: доля R_MAX в секунду на пике
const SING_DISC_H = BALL_RADIUS * 1.6 // высота диска (сплющивается к центру)
const SING_SIZE = BALL_RADIUS * 0.16  // размер частицы
const SING_OPACITY = 0.9
const SING_APPEAR_FRAC = 0.2          // доля заряда, за которую вихрь проявляется
const SING_COLOR = '#aaccff'

// --- Вспышка коллапса в момент выстрела. ---
const FLASH_COLOR = '#ffffff'
const FLASH_FRAC = 0.45               // доля фазы сдувания, за которую вспышка гаснет
const FLASH_SCALE = 2.6               // конечный масштаб вспышки (от радиуса шара)
const FLASH_OPACITY = 0.8

/** «Сингулярность»: шар коллапсирует, вокруг — светящийся вихрь всасываемых частиц; выстрел = вспышка. */
export class SingularityWindupFx implements IWindupFx {
  readonly object3d = new THREE.Group()
  private points: THREE.Points
  private pmat: THREE.PointsMaterial
  private positions: Float32Array
  private angles: Float32Array
  private radii: Float32Array
  private heights: Float32Array
  private dark = new THREE.Color(SING_DARK)
  private flash: THREE.Mesh
  private fmat: THREE.MeshBasicMaterial

  constructor() {
    this.positions = new Float32Array(SING_PARTICLES * 3)
    this.angles = new Float32Array(SING_PARTICLES)
    this.radii = new Float32Array(SING_PARTICLES)
    this.heights = new Float32Array(SING_PARTICLES)
    for (let i = 0; i < SING_PARTICLES; i++) this.resetParticle(i, true)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.pmat = new THREE.PointsMaterial({
      color: SING_COLOR, size: SING_SIZE, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
    this.points = new THREE.Points(geo, this.pmat)
    this.points.userData.noRaycast = true
    this.fmat = new THREE.MeshBasicMaterial({
      color: FLASH_COLOR, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 16, 16), this.fmat)
    this.flash.userData.noRaycast = true
    this.flash.visible = false
    this.object3d.add(this.points, this.flash)
    this.object3d.visible = false
  }

  /** Новая орбита частицы. randomRadius — стартовое заполнение всего диска (не кольцом). */
  private resetParticle(i: number, randomRadius = false) {
    this.angles[i] = Math.random() * Math.PI * 2
    this.radii[i] = randomRadius ? SING_R_MIN + Math.random() * (SING_R_MAX - SING_R_MIN) : SING_R_MAX
    this.heights[i] = (Math.random() - 0.5) * SING_DISC_H
  }

  apply(dt: number, t: WindupTarget, f: WindupFrame): void {
    const charging = f.progress > 0
    const flashing = !charging && f.shrink < 1
    this.object3d.visible = (charging || flashing) && f.visible
    this.object3d.position.copy(f.origin)

    if (charging) {
      t.mesh.scale.setScalar(1 - SING_SHRINK * f.progress)
      t.material.color.lerpColors(f.baseColor, this.dark, f.progress)
      this.stepVortex(dt, f.progress)
      this.flash.visible = false
    } else if (flashing) {
      t.mesh.scale.setScalar(1 - SING_SHRINK * (1 - f.shrink))   // возврат к норме
      t.material.color.copy(f.baseColor)
      this.pmat.opacity = 0
      this.points.visible = false
      const k = Math.min(f.shrink / FLASH_FRAC, 1)               // 0→1 — разлёт и угасание вспышки
      this.flash.visible = k < 1
      this.flash.scale.setScalar(1 + (FLASH_SCALE - 1) * k)
      this.fmat.opacity = FLASH_OPACITY * (1 - k)
    } else {
      t.mesh.scale.setScalar(1)
      t.material.color.copy(f.baseColor)
      this.pmat.opacity = 0
      this.points.visible = false
      this.flash.visible = false
    }
    t.material.emissive.setScalar(0)
  }

  /** Шаг вихря: спираль внутрь, поглощённые частицы рождаются заново на внешнем радиусе. */
  private stepVortex(dt: number, progress: number) {
    this.points.visible = true
    this.pmat.opacity = SING_OPACITY * Math.min(progress / SING_APPEAR_FRAC, 1)
    const spin = SING_SPIN_MIN + SING_SPIN_GAIN * progress
    const pull = SING_PULL * progress * SING_R_MAX
    for (let i = 0; i < SING_PARTICLES; i++) {
      this.angles[i] += spin * dt
      this.radii[i] -= pull * dt
      if (this.radii[i] < SING_R_MIN) this.resetParticle(i)
      const r = this.radii[i]
      const squash = r / SING_R_MAX                              // диск сплющивается к центру
      this.positions[i * 3]     = Math.cos(this.angles[i]) * r
      this.positions[i * 3 + 1] = this.heights[i] * squash
      this.positions[i * 3 + 2] = Math.sin(this.angles[i]) * r
    }
    ;(this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    this.points.geometry.dispose()
    this.pmat.dispose()
    this.flash.geometry.dispose()
    this.fmat.dispose()
  }
}
