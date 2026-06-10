import * as THREE from 'three'
import { BALL_RADIUS } from '../../../constants'
import type { IWindupFx, WindupTarget, WindupFrame } from './types'

// --- Шар: лёгкий раздув + потемнение в «обугленный» с пульсирующим красным свечением. ---
const RAGE_SCALE_GAIN = 0.25          // прирост масштаба к пику (меньше дефолтного — пугает не размер)
const RAGE_BODY_DARK = '#1a0505'      // цвет «обугленного» тела на пике заряда
const RAGE_EMISSIVE = '#ff2200'       // цвет раскалённого свечения
const RAGE_PULSE_HZ_MIN = 1.5         // частота пульса свечения в начале заряда
const RAGE_PULSE_HZ_MAX = 6           // и на пике (ограничена — фоточувствительность)
const RAGE_PULSE_DEPTH = 0.45         // глубина колебания свечения (яркость ходит 0.55..1.0)

// --- Челюсти: две дуги треугольных зубов — «голограмма» перед игроком. ---
const JAW_TEETH = 6                   // зубов в каждой челюсти (чётное → ряд симметричен, без центрального)
const JAW_WIDTH = BALL_RADIUS * 4.7   // размах дуги (крупнее шара, но не подавляет модельку)
const JAW_TOOTH_LEN = BALL_RADIUS * 1.5
const JAW_TOOTH_LEN_VAR = 0.35        // вариация длины зуба (доля), детерминированная по индексу
const JAW_TOOTH_W = JAW_WIDTH / JAW_TEETH * 0.85   // ширина основания зуба (с зазором между зубами)
const JAW_ARCH = BALL_RADIUS * 0.75   // прогиб дуги (центр выше краёв)
const JAW_GAP = BALL_RADIUS * 0.33    // базовый зазор между челюстями (закрытая пасть)
const JAW_DISTANCE = BALL_RADIUS * 1.8  // насколько перед шаром висит проекция (близко, но не внутри)
const JAW_OPEN_DIST = BALL_RADIUS * 2.8   // ход челюсти при полном раскрытии (широкий зев)
const JAW_OPEN_RAD = 0.85             // дополнительный развал поворотом (радианы)
const JAW_OPACITY = 0.4               // базовая непрозрачность голограммы
const JAW_COLOR = '#e8f4ff'           // холодный бело-голубой «экран»
const JAW_APPEAR_FRAC = 0.15          // доля заряда, за которую проекция проявляется
const JAW_SNAP_FRAC = 0.3             // доля фазы сдувания, за которую пасть захлопывается
// Глитч: редкие рывки проекции (смещение + просадка прозрачности). Частота ограничена (фоточувствительность).
const GLITCH_INTERVAL_MS = 160        // минимальный интервал между рывками (≤ ~6 Гц)
const GLITCH_CHANCE = 0.45            // вероятность рывка в каждом интервале
const GLITCH_DURATION_MS = 70
const GLITCH_SHIFT = BALL_RADIUS * 0.25
const GLITCH_OPACITY_DROP = 0.55      // множитель прозрачности во время рывка

/** Детерминированная псевдослучайность по индексу зуба (рваный контур без Math.random в геометрии). */
const toothVar = (i: number) => 1 - JAW_TOOTH_LEN_VAR * (0.5 + 0.5 * Math.sin(i * 12.9898))

/** Дуга треугольных зубов. up=true — верхняя челюсть (зубы смотрят вниз). */
function buildJaw(up: boolean, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  for (let i = 0; i < JAW_TEETH; i++) {
    const t = i / (JAW_TEETH - 1)                                  // 0..1 вдоль дуги
    const arch = JAW_ARCH * (1 - (2 * t - 1) ** 2)                 // парабола: центр выше краёв
    const len = JAW_TOOTH_LEN * toothVar(i + (up ? 0 : 3))         // у нижней челюсти свой рисунок
    const dir = up ? -1 : 1
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      -JAW_TOOTH_W / 2, 0, 0,
       JAW_TOOTH_W / 2, 0, 0,
       0, dir * len, 0,
    ], 3))
    const tooth = new THREE.Mesh(geo, mat)
    tooth.position.set((t - 0.5) * JAW_WIDTH, (JAW_GAP / 2 + arch) * (up ? 1 : -1), 0)
    tooth.userData.noRaycast = true
    g.add(tooth)
  }
  return g
}

/**
 * «Ярость Зорна» (Remember Me): шар раскаляется изнутри, перед игроком — гигантская глючащая
 * голограмма человеческих челюстей, раскрывающаяся с зарядом; на выстреле пасть захлопывается.
 */
export class RageWindupFx implements IWindupFx {
  readonly object3d = new THREE.Group()
  private upper: THREE.Group
  private lower: THREE.Group
  private mat: THREE.MeshBasicMaterial
  private bodyDark = new THREE.Color(RAGE_BODY_DARK)
  private emissive = new THREE.Color(RAGE_EMISSIVE)
  private time = 0                 // локальное время (пульс свечения)
  private glitchTimer = 0          // остаток текущего рывка, мс
  // Инициализируем cooldown полным интервалом: первый бросок монетки — только после GLITCH_INTERVAL_MS.
  // Это гарантирует, что в первом кадре глитч не применяется (детерминированность теста позиции).
  private glitchCooldown = GLITCH_INTERVAL_MS
  private glitchOffset = new THREE.Vector3()
  private forward = new THREE.Vector3()
  private lookTarget = new THREE.Vector3()

  constructor() {
    this.mat = new THREE.MeshBasicMaterial({
      color: JAW_COLOR, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
    this.upper = buildJaw(true, this.mat)
    this.lower = buildJaw(false, this.mat)
    this.object3d.add(this.upper, this.lower)
    this.object3d.visible = false
  }

  apply(dt: number, t: WindupTarget, f: WindupFrame): void {
    this.time += dt
    if (f.progress > 0) {
      t.mesh.scale.setScalar(1 + f.progress * RAGE_SCALE_GAIN)
      t.material.color.lerpColors(f.baseColor, this.bodyDark, f.progress)
      const hz = RAGE_PULSE_HZ_MIN + (RAGE_PULSE_HZ_MAX - RAGE_PULSE_HZ_MIN) * f.progress
      const pulse = 1 - RAGE_PULSE_DEPTH * (0.5 + 0.5 * Math.sin(this.time * hz * 2 * Math.PI))
      t.material.emissive.copy(this.emissive).multiplyScalar(f.progress * pulse)
    } else if (f.shrink < 1) {
      t.mesh.scale.setScalar(1 + RAGE_SCALE_GAIN * (1 - f.shrink))
      t.material.color.copy(f.baseColor)
      t.material.emissive.copy(this.emissive).multiplyScalar(1 - f.shrink)   // свечение гаснет
    } else {
      t.mesh.scale.setScalar(1)
      t.material.color.copy(f.baseColor)
      t.material.emissive.setScalar(0)
    }
    this.applyJaws(dt, f)
  }

  private applyJaws(dt: number, f: WindupFrame) {
    const active = f.progress > 0 || f.shrink < 1
    this.object3d.visible = active && f.visible
    if (!this.object3d.visible) return

    // Проекция висит перед игроком по горизонтальной проекции взгляда.
    this.forward.copy(f.aimDir).setY(0)
    if (this.forward.lengthSq() < 1e-8) this.forward.set(0, 0, -1)
    this.forward.normalize()
    this.object3d.position.copy(f.origin).addScaledVector(this.forward, JAW_DISTANCE)
    // lookAt ждёт МИРОВУЮ точку: в превью родитель (группа шара) сдвинут и отмасштабирован,
    // поэтому цель строим от мировой позиции (направление у родителей без вращения не искажается).
    // Инвариант: родители object3d не должны иметь вращений (сдвиг и равномерный масштаб допустимы).
    this.object3d.getWorldPosition(this.lookTarget).add(this.forward)
    this.object3d.lookAt(this.lookTarget)

    // Раскрытие: растёт с зарядом; после выстрела пасть ЗАХЛОПЫВАЕТСЯ за JAW_SNAP_FRAC фазы сдувания.
    const open = f.progress > 0 ? f.progress : Math.max(0, 1 - f.shrink / JAW_SNAP_FRAC)
    this.upper.position.y = open * JAW_OPEN_DIST
    this.lower.position.y = -open * JAW_OPEN_DIST
    this.upper.rotation.x = -open * JAW_OPEN_RAD
    this.lower.rotation.x = open * JAW_OPEN_RAD

    // Прозрачность: проявление в начале заряда; после выстрела — растворение.
    const appear = f.progress > 0 ? Math.min(f.progress / JAW_APPEAR_FRAC, 1) : 1 - f.shrink

    // Глитч: ограниченная частота рывков (см. константы).
    const ms = dt * 1000
    this.glitchTimer = Math.max(0, this.glitchTimer - ms)
    this.glitchCooldown -= ms
    if (this.glitchCooldown <= 0) {
      this.glitchCooldown = GLITCH_INTERVAL_MS
      if (Math.random() < GLITCH_CHANCE) {
        this.glitchTimer = GLITCH_DURATION_MS
        this.glitchOffset.set((Math.random() - 0.5) * 2 * GLITCH_SHIFT, (Math.random() - 0.5) * GLITCH_SHIFT, 0)
      }
    }
    const glitching = this.glitchTimer > 0
    if (glitching) this.object3d.position.add(this.glitchOffset)
    this.mat.opacity = JAW_OPACITY * appear * (glitching ? GLITCH_OPACITY_DROP : 1)
  }

  dispose(): void {
    for (const g of [this.upper, this.lower]) g.children.forEach(c => (c as THREE.Mesh).geometry.dispose())
    this.mat.dispose()
  }
}
