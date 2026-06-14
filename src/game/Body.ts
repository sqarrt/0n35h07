import * as THREE from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import type { MeshUserData } from '../utils/raycast'
import {
  EYE_HEIGHT, GRAVITY, JUMP_FORCE, BODY_MESH_Y, HITBOX_Y,
  DASH_SPEED, DASH_DURATION, DASH_COOLDOWN, KNOCKBACK_SPEED, KNOCKBACK_DURATION, KNOCKBACK_UP_SPEED, NET_REMOTE_LERP, NET_RECONCILE_LERP,
  BALL_RADIUS, BALL_SEGMENTS,
  MAX_AIR_JUMPS, GROUND_ACCEL, GROUND_FRICTION, AIR_ACCEL, AIR_WISH_SPEED, MAX_SPEED, SLOPE_MIN_NORMAL_Y,
} from '../constants'
import type { BallModel } from '../constants'
import { createBallMaterial, createBallRing } from './fx/ballMaterial'
import type { BallArt } from './ballArt'

type XYZ = { x: number; y: number; z: number }

// Scratch для ориентации визуала «лицом» к направлению (без аллокаций в кадре).
const _faceMat = new THREE.Matrix4()
const _faceUp = new THREE.Vector3(0, 1, 0)
const _faceOrigin = new THREE.Vector3(0, 0, 0)
const _faceTarget = new THREE.Vector3()
// Scratch для шага движения (без аллокаций в кадре).
const _wishDir = new THREE.Vector3()
const _knock = new THREE.Vector3()   // scratch: нормализованное 3D-направление отброса

/**
 * Тело сущности. Позицию и столкновения держит Rapier (kinematic RigidBody + KCC);
 * Body лишь КОПИТ намерение движения (desired) и кэширует позицию из rb. Меш-сфера —
 * визуал, хитбокс — raycast-цель боёвки с entityId. Едино для игрока и ботов.
 */
export class Body {
  readonly position = new THREE.Vector3(0, EYE_HEIGHT, 0)   // кэш rb.translation()
  readonly object3d = new THREE.Group()                     // локально (origin) — трансформ даёт RigidBody
  readonly mesh:     THREE.Mesh
  readonly material: THREE.MeshStandardMaterial

  rb: RapierRigidBody | null = null
  velocityY = 0
  grounded  = true
  justJumped = false   // прыжок применён в этом кадре (для SFX); живёт один кадр (выставляется в stepJump)

  private velH = new THREE.Vector3()        // персистентная горизонтальная скорость (Quake-инерция)
  private wishVel = new THREE.Vector3()     // желаемая скорость из ввода за кадр (величина = wishspeed)
  private airJumps = 0                       // оставшиеся воздушные прыжки (двойной прыжок)
  private jumpHeld = false                   // удержание прыжка (auto-bhop) — ввод за кадр
  private prevJumpHeld = false               // для детекта ребра (нового нажатия) → воздушный прыжок
  private jumpedThisFrame = false            // прыжок в этом кадре → пропустить трение (bhop)
  private desired = new THREE.Vector3()
  private teleport: THREE.Vector3 | null = null
  private netTarget: THREE.Vector3 | null = null   // целевая позиция удалённого игрока (клиент)
  private dashDir = new THREE.Vector3()
  private dashTimer = 0
  private dashCooldown = 0
  private knockDir = new THREE.Vector3()   // импульс-отброс при пересечении с другим игроком (как рывок, но не рывок)
  private knockTimer = 0
  private shaderTick: (dt: number) => void
  private ballFx: ReturnType<typeof createBallMaterial>
  private ring: ReturnType<typeof createBallRing> | null = null

  constructor(entityId: number, color: string, model: BallModel = 'smooth', ringColor: string = color, art?: BallArt) {
    const ball = createBallMaterial(color, model, art)   // материал сферы по модели (smooth/waves/planet) + рисунок
    this.ballFx = ball
    this.material = ball.material
    this.shaderTick = ball.tick
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, BALL_SEGMENTS, BALL_SEGMENTS), this.material)
    this.mesh.position.y = BODY_MESH_Y
    this.mesh.castShadow = true
    ;(this.mesh.userData as MeshUserData).noRaycast = true

    if (model === 'planet') {   // кольцо — дочерний меш сферы (масштабируется/гаснет вместе с планетой)
      const ring = createBallRing(ringColor)   // «второй» цвет (как в меню); по умолчанию = цвет шара
      this.mesh.add(ring.mesh)
      this.ring = ring
    }

    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    hitbox.position.y = HITBOX_Y
    hitbox.visible = false
    ;(hitbox.userData as MeshUserData).entityId = entityId

    this.object3d.add(this.mesh, hitbox)
  }

  bindBody(rb: RapierRigidBody) {
    this.rb = rb
    this.desired.set(0, 0, 0)   // сбросить горизонтальное намерение, накопленное до готовности физики
    rb.setNextKinematicTranslation(this.position)   // velocityY НЕ трогаем — прыжок во время загрузки сохраняется
  }
  unbind() { this.rb = null }

  /** Желаемая горизонтальная скорость за кадр (НЕ интегрируем сразу — копит stepHorizontal через velH). */
  move(worldDir: THREE.Vector3, _dt: number) {
    this.wishVel.copy(worldDir)
  }

  /** Удержание прыжка за кадр (held-ввод): на земле — авто-bhop, в воздухе — двойной по новому нажатию. */
  setJumpInput(held: boolean) { this.jumpHeld = held }

  /** Обработка прыжка (в Match.applyPhysics ДО stepVertical; grounded — с прошлого кадра). */
  stepJump() {
    this.jumpedThisFrame = false
    this.justJumped = false
    const edge = this.jumpHeld && !this.prevJumpHeld
    if (this.grounded && this.jumpHeld) {
      this.velocityY = JUMP_FORCE          // auto-bhop: держишь прыжок → прыжок на каждом приземлении
      this.airJumps = MAX_AIR_JUMPS        // гарантируем воздушный прыжок даже на первом прыжке со спавна
      this.jumpedThisFrame = true
      this.justJumped = true
    } else if (edge && !this.grounded && this.airJumps > 0) {
      this.velocityY = JUMP_FORCE          // двойной прыжок — только по НОВОМУ нажатию в воздухе
      this.airJumps--
      this.justJumped = true
    }
    this.prevJumpHeld = this.jumpHeld
  }

  /** Накопить вертикаль (вызывается из Match.applyPhysics перед шагом KCC). */
  stepVertical(dt: number) {
    this.velocityY += GRAVITY * dt
    this.desired.y += this.velocityY * dt
  }

  /**
   * Горизонтальный шаг (Quake): на земле — трение (кроме кадра прыжка → bhop) + быстрый разгон к wishspeed
   * и следование склону без потери скорости; в воздухе — air-accelerate с кэпом (разгон стрейфом+мышью).
   * `groundNormal` — нормаль поверхности под игроком (или null → плоско). Копит результат в desired.
   */
  stepHorizontal(dt: number, groundNormal: THREE.Vector3 | null) {
    const wishspeed = this.wishVel.length()
    if (wishspeed > 1e-6) _wishDir.copy(this.wishVel).divideScalar(wishspeed)
    else _wishDir.set(0, 0, 0)

    if (this.grounded) {
      if (!this.jumpedThisFrame) this.velH.multiplyScalar(Math.max(0, 1 - GROUND_FRICTION * dt))
      if (wishspeed > 1e-6) this.accelerate(_wishDir, wishspeed, GROUND_ACCEL, dt)
      this.followSlope(groundNormal, dt)   // на подъёме скорость не съедается (Fix: замедление на рампе)
    } else if (wishspeed > 1e-6) {
      this.accelerate(_wishDir, Math.min(wishspeed, AIR_WISH_SPEED), AIR_ACCEL, dt)
    }

    if (this.velH.lengthSq() > MAX_SPEED * MAX_SPEED) this.velH.setLength(MAX_SPEED)   // верхний предел скорости

    this.desired.x += this.velH.x * dt
    this.desired.z += this.velH.z * dt
  }

  /** Quake-accelerate: добавляет скорость к wishdir не превышая wishspeed (только разгоняет, не тормозит). */
  private accelerate(wishdir: THREE.Vector3, wishspeed: number, accel: number, dt: number) {
    const current = this.velH.dot(wishdir)
    const add = wishspeed - current
    if (add <= 0) return
    const accelSpeed = Math.min(accel * wishspeed * dt, add)
    this.velH.addScaledVector(wishdir, accelSpeed)
  }

  /** На склоне даём desired вертикальную добавку, чтобы движение шло вдоль поверхности (v·n=0) —
   *  горизонтальная скорость не теряется на подъёме/спуске. Плоскость/стена/нет нормали → ничего. */
  private followSlope(groundNormal: THREE.Vector3 | null, dt: number) {
    if (!groundNormal || groundNormal.y < SLOPE_MIN_NORMAL_Y) return
    const vy = -(groundNormal.x * this.velH.x + groundNormal.z * this.velH.z) / groundNormal.y
    this.desired.y += vy * dt
  }

  /** Мгновенно обнулить кулдаун рывка (награда за снятие серии). */
  resetDashCooldown() { this.dashCooldown = 0 }

  /** Старт рывка: true если кулдаун готов и направление ненулевое. Направление 3D — рывок учитывает наклон взгляда. */
  dash(dir: THREE.Vector3): boolean {
    if (this.dashCooldown > 0) return false
    this.dashDir.set(dir.x, dir.y, dir.z)
    if (this.dashDir.lengthSq() === 0) return false
    this.dashDir.normalize()
    this.dashTimer = DASH_DURATION
    this.dashCooldown = DASH_COOLDOWN
    return true
  }

  /** Копит рывок в desired и тикает таймеры (зовётся из Match.applyPhysics). */
  stepDash(dt: number) {
    if (this.dashCooldown > 0) this.dashCooldown -= dt * 1000
    if (this.dashTimer > 0) {
      this.desired.addScaledVector(this.dashDir, DASH_SPEED * dt)
      this.dashTimer -= dt * 1000
    }
  }

  get dashing() { return this.dashTimer > 0 }

  /** Импульс-отброс в направлении `dir` (3D, как рывок, но не рывок): сильный толчок при пересечении игроков.
   *  Горизонтальная доля — burst в desired (как рывок); вертикальная (вверх) — импульс velocityY,
   *  перебивающий падение, чтобы запрыгнув сверху реально подбросило вверх с дугой. */
  knockback(dir: THREE.Vector3) {
    _knock.copy(dir)
    if (_knock.lengthSq() === 0) return
    _knock.normalize()
    // Горизонтальная часть = горизонтальная проекция единичного вектора (|.|≤1: чем отвеснее контакт, тем слабее вбок).
    this.knockDir.set(_knock.x, 0, _knock.z)
    this.knockTimer = KNOCKBACK_DURATION
    // Вертикальная часть — импульс вверх поверх текущей velocityY (Math.max → перебивает падение, не складывается).
    if (_knock.y > 0) this.velocityY = Math.max(this.velocityY, _knock.y * KNOCKBACK_UP_SPEED)
  }

  /** Копит отброс в desired и тикает таймер (зовётся из Match.applyPhysics, как stepDash). */
  stepKnockback(dt: number) {
    if (this.knockTimer > 0) {
      this.desired.addScaledVector(this.knockDir, KNOCKBACK_SPEED * dt)
      this.knockTimer -= dt * 1000
    }
  }

  /** Идёт ли сейчас окно отброса — чтобы Match не перезапускал импульс каждый кадр пересечения. */
  get knocking() { return this.knockTimer > 0 }

  /** Текущая горизонтальная скорость (ед/с) — для оверлея скорости. */
  get horizontalSpeed() { return Math.hypot(this.velH.x, this.velH.z) }

  /** Прогресс готовности рывка: 1 = готов, 0..1 во время кулдауна. */
  dashProgress(): number {
    return this.dashCooldown > 0 ? Math.max(0, 1 - this.dashCooldown / DASH_COOLDOWN) : 1
  }

  consumeDesired(): THREE.Vector3 {
    const d = this.desired.clone()
    this.desired.set(0, 0, 0)
    return d
  }

  setGrounded(g: boolean) {
    this.grounded = g
    if (g) { this.velocityY = 0; this.airJumps = MAX_AIR_JUMPS }   // приземлились → восстановить воздушные прыжки
  }

  /** Полная остановка (заморозка готовности/отсчёта/конца матча): гасим инерцию и намерение. */
  halt() {
    this.velH.set(0, 0, 0)
    this.wishVel.set(0, 0, 0)
    this.velocityY = 0
  }

  setPosition(p: THREE.Vector3) {
    this.position.copy(p)
    this.velocityY = 0
    this.velH.set(0, 0, 0)        // респавн/телепорт — инерцию не переносим
    this.wishVel.set(0, 0, 0)
    this.grounded = p.y <= EYE_HEIGHT + 0.01
    this.teleport = p.clone()
    this.netTarget = null   // респавн/телепорт — старый авторитет недействителен
    this.dashTimer = 0
    this.dashCooldown = 0
  }
  consumeTeleport(): THREE.Vector3 | null {
    const t = this.teleport
    this.teleport = null
    return t
  }

  // --- networking: позиция удалённого игрока (клиент рендерит из снапшотов) ---
  applyNetTarget(pos: THREE.Vector3) {
    if (this.netTarget) this.netTarget.copy(pos)
    else this.netTarget = pos.clone()
  }
  hasNetTarget() { return this.netTarget !== null }
  /** Следующая позиция: плавный шаг от текущей (rb/кэш) к сетевой цели. */
  nextRemoteTranslation(): XYZ {
    const cur = this.rb ? this.rb.translation() : this.position
    const t = this.netTarget ?? this.position
    return {
      x: THREE.MathUtils.lerp(cur.x, t.x, NET_REMOTE_LERP),
      y: THREE.MathUtils.lerp(cur.y, t.y, NET_REMOTE_LERP),
      z: THREE.MathUtils.lerp(cur.z, t.z, NET_REMOTE_LERP),
    }
  }

  /** Свой игрок (клиент): мягко тянем результат KCC к авторитету — анти-дрейф при коллизиях. */
  reconcileTowardNet(next: XYZ) {
    if (!this.netTarget) return
    next.x += (this.netTarget.x - next.x) * NET_RECONCILE_LERP
    next.y += (this.netTarget.y - next.y) * NET_RECONCILE_LERP
    next.z += (this.netTarget.z - next.z) * NET_RECONCILE_LERP
  }

  /** Кэшируем позицию из физического тела (результат прошлого шага). */
  syncFromBody() {
    if (!this.rb) return
    const t = this.rb.translation()
    this.position.set(t.x, t.y, t.z)
  }

  setVisible(v: boolean) { this.mesh.visible = v }

  /**
   * Ориентирует визуальную сферу «лицом» по направлению прицела — ТОЛЬКО рысканье (горизонталь):
   * модель остаётся вертикальной, не наклоняется по тангажу/крену при взгляде вверх-вниз. Крутится
   * только меш (сфера + кольцо планеты); хитбокс не трогаем — боёвка стабильна.
   */
  faceDir(dir: THREE.Vector3) {
    _faceTarget.set(dir.x, 0, dir.z)   // проекция на горизонталь → чистый yaw, без наклона
    if (_faceTarget.lengthSq() < 1e-8) return   // прицел почти вертикальный — ориентацию не трогаем
    _faceMat.lookAt(_faceOrigin, _faceTarget, _faceUp)
    this.mesh.quaternion.setFromRotationMatrix(_faceMat)
  }

  /** Двигает время шейдеров модели (волны / дрейф кольца). Для smooth — no-op. */
  tickShader(dt: number) { this.shaderTick(dt); this.ring?.tick(dt) }

  /** Обновить рисунок на шаре на месте (живое превью в меню; без пересоздания материала). */
  setArt(art: BallArt | null) { this.ballFx.setArt(art) }

  /** Прозрачность визуала (призрак/материализация): сфера + кольцо. */
  setOpacity(o: number) { this.material.opacity = o; this.ring?.setOpacity(o) }

  // --- кольцо планеты: доступ для превью в меню (живая смена «второго» цвета, слой свечения) ---
  /** Меш кольца планеты; null у моделей без кольца. */
  get ringMesh() { return this.ring?.mesh ?? null }
  /** Плавная смена цвета кольца (для моделей без кольца — no-op). */
  lerpRingColor(c: THREE.Color, t: number) { this.ring?.lerpColor(c, t) }
  /** Мгновенная установка цвета кольца. */
  setRingColor(c: THREE.Color) { this.ring?.setColor(c) }

  /** Вкл/выкл хитбокс как raycast-цель: мёртвый/сдувающийся шар нельзя застрелить повторно. */
  setHittable(v: boolean) {
    const hitbox = this.object3d.children[1] as THREE.Mesh
    ;(hitbox.userData as MeshUserData).noRaycast = !v
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.ballFx.dispose()        // текстура рисунка
    this.ring?.dispose()
    const hb = this.object3d.children[1] as THREE.Mesh
    hb.geometry.dispose()
    ;(hb.material as THREE.Material).dispose()
  }
}
