import * as THREE from 'three'
import { BEAM_DURATION } from '../../../constants'
import type { IBeamFx } from './types'

// «Рваный разряд»: сегментированный луч с глитч-джиттером (в характере челюстей rage).
const SEGMENTS = 7               // сегментов оболочки вдоль линии выстрела
const CORE_RADIUS = 0.04         // сплошное белое ядро (тоньше дефолтного)
const SEG_RADIUS = 0.16          // радиус сегмента оболочки
const SEG_OPACITY = 0.7
const SEG_LEN_FRAC = 0.8         // доля длины сегмента от шага — зазоры читаются как «разрывы»
const JITTER_MAX = 0.22          // максимум поперечного смещения сегмента (мировые ед.)
const JITTER_INTERVAL_MS = 90    // частота смены джиттера (ограничена — фоточувствительность)
const PULSE_HZ = 9               // пульс толщины
const PULSE_DEPTH = 0.2          // глубина пульса (±20%)
const CYL_SEGMENTS = 6
// Рваное затухание: ступени прозрачности по ходу жизни луча (вместо плавного шринка) — «срывы» разряда.
const FADE_STEPS: { until: number; level: number }[] = [
  { until: 0.45, level: 1 },
  { until: 0.6,  level: 0.35 },
  { until: 0.75, level: 0.8 },
  { until: 0.9,  level: 0.25 },
  { until: 1,    level: 0.1 },
]
const UP = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)

/** Луч стиля rage: белое ядро + рваные сегменты цвета игрока, дребезжащие поперёк, ступенчатое затухание. */
export class RageBeamFx implements IBeamFx {
  readonly object3d = new THREE.Group()
  private core: THREE.Mesh
  private coreMat: THREE.MeshBasicMaterial
  private segs: THREE.Mesh[] = []
  private segMat: THREE.MeshBasicMaterial
  private offsets: THREE.Vector2[] = []   // поперечные смещения сегментов в базисе (side1, side2)

  private active = false
  private elapsed = 0          // мс с момента выстрела
  private jitterTimer = 0      // мс до следующей смены джиттера
  private time = 0             // локальное время (пульс толщины)
  private start = new THREE.Vector3()
  private end = new THREE.Vector3()
  private quat = new THREE.Quaternion()   // ориентация цилиндров вдоль луча
  private dirN = new THREE.Vector3()
  private side1 = new THREE.Vector3()
  private side2 = new THREE.Vector3()
  private scratch = new THREE.Vector3()
  private len = 0

  constructor(playerColor: string) {
    this.coreMat = new THREE.MeshBasicMaterial({
      color: 'white', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    this.core = new THREE.Mesh(new THREE.CylinderGeometry(CORE_RADIUS, CORE_RADIUS, 1, CYL_SEGMENTS), this.coreMat)
    this.core.userData.noRaycast = true
    this.core.visible = false
    this.segMat = new THREE.MeshBasicMaterial({
      color: playerColor, transparent: true, opacity: SEG_OPACITY, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    for (let i = 0; i < SEGMENTS; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(SEG_RADIUS, SEG_RADIUS, 1, CYL_SEGMENTS), this.segMat)
      seg.userData.noRaycast = true
      seg.visible = false
      this.segs.push(seg)
      this.offsets.push(new THREE.Vector2())
    }
    this.object3d.add(this.core, ...this.segs)
  }

  play(start: THREE.Vector3, end: THREE.Vector3): void {
    this.start.copy(start)
    this.end.copy(end)
    this.dirN.copy(end).sub(start)
    this.len = this.dirN.length()
    if (this.len < 1e-6) return
    this.dirN.divideScalar(this.len)
    this.quat.setFromUnitVectors(UP, this.dirN)
    // Поперечный базис: для вертикального луча dir×UP вырождается → берём X.
    this.side1.crossVectors(this.dirN, UP)
    if (this.side1.lengthSq() < 1e-8) this.side1.copy(X_AXIS)
    this.side1.normalize()
    this.side2.crossVectors(this.dirN, this.side1).normalize()
    this.active = true
    this.elapsed = 0
    this.jitterTimer = 0   // первый же кадр бросает джиттер
  }

  private rollJitter() {
    for (const o of this.offsets) {
      o.set((Math.random() - 0.5) * 2 * JITTER_MAX, (Math.random() - 0.5) * 2 * JITTER_MAX)
    }
  }

  update(dt: number): void {
    this.time += dt
    if (!this.active) return
    this.elapsed += dt * 1000
    const t = this.elapsed / BEAM_DURATION
    if (t >= 1) { this.hide(); return }

    this.jitterTimer -= dt * 1000
    if (this.jitterTimer <= 0) { this.jitterTimer = JITTER_INTERVAL_MS; this.rollJitter() }

    const level = (FADE_STEPS.find(s => t < s.until) ?? FADE_STEPS[FADE_STEPS.length - 1]).level
    const pulse = 1 + PULSE_DEPTH * Math.sin(this.time * PULSE_HZ * 2 * Math.PI)
    this.coreMat.opacity = level
    this.segMat.opacity = SEG_OPACITY * level

    // Ядро — сплошное, по всей линии.
    this.core.position.copy(this.start).lerp(this.end, 0.5)
    this.core.quaternion.copy(this.quat)
    this.core.scale.set(pulse, this.len, pulse)
    this.core.visible = true

    // Сегменты оболочки — вдоль линии с поперечным дребезгом.
    const segLen = (this.len / SEGMENTS) * SEG_LEN_FRAC
    for (let i = 0; i < SEGMENTS; i++) {
      const seg = this.segs[i]
      const off = this.offsets[i]
      this.scratch.copy(this.start).lerp(this.end, (i + 0.5) / SEGMENTS)
        .addScaledVector(this.side1, off.x)
        .addScaledVector(this.side2, off.y)
      seg.position.copy(this.scratch)
      seg.quaternion.copy(this.quat)
      seg.scale.set(pulse, segLen, pulse)
      seg.visible = true
    }
  }

  private hide() {
    this.active = false
    this.core.visible = false
    for (const s of this.segs) s.visible = false
  }

  reset(): void { this.hide() }

  dispose(): void {
    this.core.geometry.dispose()
    this.coreMat.dispose()
    this.segs.forEach(s => s.geometry.dispose())
    this.segMat.dispose()
  }
}
