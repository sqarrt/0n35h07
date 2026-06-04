import * as THREE from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import {
  EYE_HEIGHT, GRAVITY, JUMP_FORCE, BODY_MESH_Y, HITBOX_Y,
  DASH_SPEED, DASH_DURATION, DASH_COOLDOWN, NET_REMOTE_LERP, NET_RECONCILE_LERP,
  BALL_RADIUS, BALL_SEGMENTS,
} from '../constants'
import type { BallModel } from '../constants'
import { createBallMaterial, createBallRing } from './fx/ballMaterial'

type XYZ = { x: number; y: number; z: number }

// Scratch для ориентации визуала «лицом» к направлению (без аллокаций в кадре).
const _faceMat = new THREE.Matrix4()
const _faceUp = new THREE.Vector3(0, 1, 0)
const _faceOrigin = new THREE.Vector3(0, 0, 0)
const _faceTarget = new THREE.Vector3()

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

  private desired = new THREE.Vector3()
  private teleport: THREE.Vector3 | null = null
  private netTarget: THREE.Vector3 | null = null   // целевая позиция удалённого игрока (клиент)
  private dashDir = new THREE.Vector3()
  private dashTimer = 0
  private dashCooldown = 0
  private shaderTick: (dt: number) => void
  private ring: { tick: (dt: number) => void; setOpacity: (o: number) => void; dispose: () => void } | null = null

  constructor(entityId: number, color: string, model: BallModel = 'smooth') {
    const ball = createBallMaterial(color, model)   // материал сферы по модели (smooth/waves/planet)
    this.material = ball.material
    this.shaderTick = ball.tick
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, BALL_SEGMENTS, BALL_SEGMENTS), this.material)
    this.mesh.position.y = BODY_MESH_Y
    this.mesh.castShadow = true
    this.mesh.userData.noRaycast = true

    if (model === 'planet') {   // кольцо — дочерний меш сферы (масштабируется/гаснет вместе с планетой)
      const ring = createBallRing(color)
      this.mesh.add(ring.mesh)
      this.ring = ring
    }

    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    hitbox.position.y = HITBOX_Y
    hitbox.visible = false
    hitbox.userData.entityId = entityId

    this.object3d.add(this.mesh, hitbox)
  }

  bindBody(rb: RapierRigidBody) {
    this.rb = rb
    this.desired.set(0, 0, 0)   // сбросить горизонтальное намерение, накопленное до готовности физики
    rb.setNextKinematicTranslation(this.position)   // velocityY НЕ трогаем — прыжок во время загрузки сохраняется
  }
  unbind() { this.rb = null }

  /** Горизонтальное намерение за кадр (Y даёт гравитация в stepVertical). */
  move(worldDir: THREE.Vector3, dt: number) {
    this.desired.x += worldDir.x * dt
    this.desired.z += worldDir.z * dt
  }

  jump() {
    if (this.grounded) this.velocityY = JUMP_FORCE
  }

  /** Накопить вертикаль (вызывается из Match.applyPhysics перед шагом KCC). */
  stepVertical(dt: number) {
    this.velocityY += GRAVITY * dt
    this.desired.y += this.velocityY * dt
  }

  /** Старт рывка: true если кулдаун готов и направление ненулевое. */
  dash(dir: THREE.Vector3): boolean {
    if (this.dashCooldown > 0) return false
    this.dashDir.set(dir.x, 0, dir.z)
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
    if (g) this.velocityY = 0
  }

  setPosition(p: THREE.Vector3) {
    this.position.copy(p)
    this.velocityY = 0
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

  /** Прозрачность визуала (призрак/материализация): сфера + кольцо. */
  setOpacity(o: number) { this.material.opacity = o; this.ring?.setOpacity(o) }

  /** Вкл/выкл хитбокс как raycast-цель: мёртвый/сдувающийся шар нельзя застрелить повторно. */
  setHittable(v: boolean) {
    const hitbox = this.object3d.children[1] as THREE.Mesh
    hitbox.userData.noRaycast = !v
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.ring?.dispose()
    const hb = this.object3d.children[1] as THREE.Mesh
    hb.geometry.dispose()
    ;(hb.material as THREE.Material).dispose()
  }
}
