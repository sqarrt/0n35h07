import * as THREE from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import type { IControllable, IWeapon, IShield, IDashTrail } from './abstractions'
import type { World } from './World'
import { Body } from './Body'
import { AfterimageTrail } from './fx/AfterimageTrail'
import { DeathBurst } from './fx/DeathBurst'
import { toVec3, fromVec3 } from '../net/protocol'
import type { PlayerSnapshot } from '../net/protocol'
import {
  MUZZLE_Y, BODY_MESH_Y, BOT_WINDUP, BOT_COLOR_WHITE, EYE_HEIGHT, WINDUP_SCALE_GAIN,
  SPAWN_ANIM_MS, SPAWN_POP, RESPAWN_GHOST_MS, RESPAWN_SPEED_MULT, RESPAWN_SPEED_RAMP, GHOST_OPACITY,
} from '../constants'

const REMOTE_AIM = new THREE.Vector3(0, 0, -1)   // фиктивный aim для косметического weapon.update удалённого

/**
 * Единая сущность игрока — и человек, и бот, и сетевой игрок. Компонует тело, оружие и
 * щит (инжектятся → DIP). Контроллеры дёргают intent-методы. Сам себя НЕ респавнит.
 *
 * Сцена-граф: bodyGroup (тело + хитбокс + щит) кладётся внутрь <RigidBody> (трансформ —
 * от Rapier); луч (weaponObject) — world-space, рендерится в match.beams.
 */
export class Player implements IControllable {
  alive = true
  respawning = false   // фаза призрака: неуязвим, движется ×3, не атакует
  respawnTimer = 0     // остаток фазы призрака (мс)
  name = ''            // отображаемое имя (Вы / Бот N) — ставит Match
  kills = 0            // счёт за сессию (не сбрасывается на респавне)
  deaths = 0
  readonly id: number
  readonly bodyGroup = new THREE.Group()
  readonly spawn = new THREE.Vector3(0, EYE_HEIGHT, 0)

  private body: Body
  private weapon: IWeapon
  private shield: IShield
  private trail: IDashTrail
  private burst: DeathBurst
  private aimPoint = new THREE.Vector3(0, EYE_HEIGHT, -100)
  private spawnTime = -Infinity   // момент начала материализации (респаун)
  private bodyMeshOffset = new THREE.Vector3(0, BODY_MESH_Y, 0)   // центр сферы относительно глаз
  private bodyVisible = true
  private frozen = false   // готовность/отсчёт перед боем — намерения подавлены
  private fireTime = -Infinity
  private baseColor: THREE.Color
  private whiteColor = new THREE.Color(BOT_COLOR_WHITE)
  // Сетевое состояние для рендера удалённого игрока на клиенте (без прогона его сима).
  private netShieldActive = false
  private netDashing = false
  private netWindup = 0
  private prevNetWindup = 0
  private netFireTime = -Infinity   // момент выстрела удалённого (фронт netWindup 1→0) — для плавного сдувания
  private netAimDir = new THREE.Vector3(0, 0, -1)   // направление взгляда удалённого (из снапшота) — для ориентации модели

  constructor(
    id: number,
    body: Body,
    weapon: IWeapon,
    shield: IShield,
    color: string,
  ) {
    this.id = id
    this.body = body
    this.weapon = weapon
    this.shield = shield
    this.baseColor = new THREE.Color(color)
    this.trail = new AfterimageTrail(this.baseColor)   // world-space визуал — кладёт Match в root
    this.burst = new DeathBurst(this.baseColor)        // хлопок частиц на смерти — тоже world-space
    shield.object3d.position.set(0, BODY_MESH_Y, 0)   // локально — едет с телом
    this.bodyGroup.add(body.object3d, shield.object3d)
    // Стабильная ссылка для ref={p.bindBody}: иначе инлайн-ref пере-привязывается
    // каждый кадр (App ре-рендерит на HUD) и ломает bound → двойной трансформ хитбокса.
    this.bindBody = this.bindBody.bind(this)
  }

  /** Луч — world-space, рендерится отдельно (вне RigidBody). */
  get weaponObject() { return this.weapon.object3d }

  /** След рывка — тоже world-space (живёт в match.root, не в RigidBody). */
  get trailObject() { return this.trail.object3d }

  /** Хлопок частиц на смерти — world-space (живёт в match.root). */
  get burstObject() { return this.burst.object3d }

  // --- Rapier binding (RigidBody = только коллайдер; визуал отдельно в world-space) ---
  bindBody(rb: RapierRigidBody | null) {
    if (!rb) { this.body.unbind(); return }
    this.body.bindBody(rb)
  }
  get rb() { return this.body.rb }
  consumeDesired()        { return this.body.consumeDesired() }
  consumeTeleport()       { return this.body.consumeTeleport() }
  stepJump()              { this.body.stepJump() }
  stepVertical(dt: number){ this.body.stepVertical(dt) }
  stepHorizontal(dt: number, groundNormal: THREE.Vector3 | null) { this.body.stepHorizontal(dt, groundNormal) }
  stepDash(dt: number)    { this.body.stepDash(dt) }
  get dashing()           { return this.body.dashing }
  get grounded()          { return this.body.grounded }
  get speed()             { return this.body.horizontalSpeed }   // горизонтальная скорость (оверлей)
  setGrounded(g: boolean) { this.body.setGrounded(g) }

  /** Кэшируем позицию из физ-тела и двигаем визуальную группу (она в world-space). */
  syncFromBody() {
    this.body.syncFromBody()
    this.bodyGroup.position.copy(this.body.position)
  }

  /** Заморозка: во время готовности/отсчёта/конца движение и действия отключены, камера/прицел — нет.
   *  Включение гасит инерцию (velH/velocityY) → игроки реально стоят (стоп-кадр конца матча). */
  setFrozen(v: boolean) { this.frozen = v; if (v) this.body.halt() }

  // --- IControllable ---
  // Движение доступно живому И призраку (в фазе респауна, ×3 скорость); атака — только живому.
  private canMove() { return !this.frozen && (this.alive || this.respawning) }
  private canAct()  { return !this.frozen && this.alive }
  moveIntent(dir: THREE.Vector3, dt: number) {
    if (!this.canMove()) return
    const m = this.respawning ? this.respawnSpeedMult() : 1
    this.body.move(m === 1 ? dir : dir.clone().multiplyScalar(m), dt)
  }

  /** Множитель скорости в фазе призрака: полный ×N, плавно спадающий к ×1 в последней RESPAWN_SPEED_RAMP. */
  private respawnSpeedMult(): number {
    const p = this.respawnTimer / RESPAWN_GHOST_MS   // 1→0
    if (p >= RESPAWN_SPEED_RAMP) return RESPAWN_SPEED_MULT
    return 1 + (RESPAWN_SPEED_MULT - 1) * (p / RESPAWN_SPEED_RAMP)
  }
  setJumpInput(held: boolean)  { this.body.setJumpInput(this.canMove() && held) }   // held → auto-bhop/двойной прыжок
  aim(point: THREE.Vector3)    { this.aimPoint.copy(point) }   // целимся В ТОЧКУ мира (доступно и в заморозке)
  startFiring()                { if (!this.canAct()) return; this.weapon.beginWindup() }
  activateShield()             { if (!this.canAct()) return; this.shield.activate() }
  dash(dir: THREE.Vector3) {
    if (!this.canAct()) return
    if (dir.lengthSq() === 0) return
    if (!this.body.dash(dir)) return   // кулдаун — заряд не трогаем
    this.weapon.interrupt()            // успешный рывок отменяет заряд
  }

  // --- simulation (без интеграции позиции — её делает Rapier KCC в Match.applyPhysics) ---
  update(dt: number, world: World, excludeIds: number[]) {
    const muzzle = this.muzzle()
    const aim = this.aimPoint.clone().sub(muzzle).normalize()  // луч сходится в точку прицела
    this.body.faceDir(aim)   // модель смотрит туда же, куда целится игрок (за камерой)
    this.weapon.update(dt, { world, muzzle, aim, excludeIds })
    this.shield.update(dt)
    this.syncVisuals()
    this.trail.update(dt, { position: this.body.position, dashing: this.body.dashing || this.respawning })
    this.burst.update(dt)
    this.body.tickShader(dt)
  }

  private muzzle(): THREE.Vector3 {
    return this.body.position.clone().add(new THREE.Vector3(0, MUZZLE_Y, 0))
  }

  private syncVisuals() {
    if (!this.bodyVisible) this.shield.object3d.visible = false   // в FP пузырь не рисуем
    if (this.weapon.justFired) this.fireTime = Date.now()

    const lc = this.lifecycleVisual()
    if (lc !== null) {   // призрак/материализация диктуют масштаб+прозрачность (в своём цвете)
      this.body.mesh.scale.setScalar(lc.scale)
      this.body.setOpacity(lc.opacity)   // сфера + кольцо
      this.body.material.color.copy(this.baseColor)
      this.shield.object3d.visible = false
      return
    }
    this.body.setOpacity(1)   // обычное состояние — непрозрачно

    const wp = this.weapon.windupProgress
    const shrinkP = Math.min((Date.now() - this.fireTime) / (BOT_WINDUP / 3), 1)
    const mat = this.body.material
    if (wp > 0) {
      this.body.mesh.scale.setScalar(1 + wp * WINDUP_SCALE_GAIN)
      mat.color.lerpColors(this.baseColor, this.whiteColor, wp)
    } else if (shrinkP < 1) {
      this.body.mesh.scale.setScalar(1 + WINDUP_SCALE_GAIN * (1 - shrinkP))
      mat.color.copy(this.baseColor)
    } else {
      this.body.mesh.scale.setScalar(1)
      mat.color.copy(this.baseColor)
    }
  }

  // --- combat (driven by Match, never self-respawn) ---
  receiveHit(): 'blocked' | 'killed' {
    if (!this.alive) return 'blocked'        // уже мёртв/призрак — не добиваем (нет двойного килла)
    if (this.shield.isActive) return 'blocked'
    this.alive = false
    this.startGhost()
    return 'killed'
  }

  /** Старт фазы призрака: неуязвимость, хлопок частиц, таймер до материализации. */
  private startGhost() {
    this.respawning = true
    this.respawnTimer = RESPAWN_GHOST_MS
    this.body.setHittable(false)
    this.weapon.interrupt()   // отменяем незавершённый заряд — призрак не достреливает
    if (this.bodyVisible) this.burst.emit(this.body.position.clone().add(this.bodyMeshOffset))
  }

  /** Клиент: локально тикаем таймер фазы (для индикации/скорости); финал — событием respawn. */
  tickRespawn(dt: number) {
    if (this.respawning) this.respawnTimer = Math.max(0, this.respawnTimer - dt * 1000)
  }

  /** Материализация на месте остановки (конец фазы призрака). pos — авторитетная позиция.
   *  ВСЕ кулдауны сбрасываются: луч (weapon.reset), щит (shield.reset), дэш (body.setPosition обнуляет кулдаун). */
  respawnAt(pos: THREE.Vector3) {
    this.spawn.copy(pos)
    this.body.setPosition(pos)   // телепорт + сброс кулдауна дэша
    this.weapon.reset()          // сброс кулдауна луча
    this.shield.reset()          // сброс кулдауна щита
    this.alive = true
    this.respawning = false
    this.spawnTime = Date.now()        // короткий упругий «пуф»
    this.respawnTimer = 0
    this.body.setHittable(true)
    this.body.material.color.copy(this.baseColor)
  }

  /** Масштаб+прозрачность во время призрака/материализации; null — обычная windup-логика. */
  private lifecycleVisual(): { scale: number; opacity: number } | null {
    if (this.respawning) return { scale: 1, opacity: GHOST_OPACITY }   // призрак: полупрозрачный
    const st = (Date.now() - this.spawnTime) / SPAWN_ANIM_MS
    if (st >= 0 && st < 1) return { scale: 1 + SPAWN_POP * Math.sin(Math.PI * st), opacity: 1 }   // пуф
    return null
  }

  setBodyVisible(v: boolean) {
    this.bodyVisible = v
    this.body.setVisible(v)
    this.trail.object3d.visible = v   // в FP свой след не показываем (камера внутри тела)
  }
  spawnImpact(point: THREE.Vector3) { this.weapon.spawnImpact(point) }

  // --- getters for Match / HUD / debug ---
  get position()            { return this.body.position }
  get isWindingUp()         { return this.weapon.isWindingUp }
  get windupProgress()      { return this.weapon.windupProgress }
  beamCooldownProgress()    { return this.weapon.cooldownProgress() }
  dashCooldownProgress()    { return this.body.dashProgress() }
  shieldProgress()          { return this.shield.progress() }
  get shieldActive()        { return this.shield.isActive }
  get weaponJustFired()     { return this.weapon.justFired }
  get fireOutcome()         { return this.weapon.outcome }
  clearJustFired()          { this.weapon.clearJustFired() }

  // --- networking (host-authoritative) ---
  get color() { return this.baseColor }

  /** Снимок состояния для рассылки (хост). */
  serializeState(): PlayerSnapshot {
    return {
      id: this.id,
      pos: toVec3(this.body.position),
      aimDir: toVec3(this.aimPoint.clone().sub(this.muzzle()).normalize()),
      alive: this.alive,
      shieldActive: this.shieldActive,
      dashing: this.dashing,
      windupProgress: this.windupProgress,
      respawning: this.respawning,
    }
  }

  /** Применить снимок к удалённому игроку (клиент): цель позиции + визуальные флаги. */
  applyNetState(snap: PlayerSnapshot) {
    this.body.applyNetTarget(fromVec3(snap.pos))
    this.alive = snap.alive
    this.respawning = snap.respawning
    this.netAimDir.copy(fromVec3(snap.aimDir))
    this.netShieldActive = snap.shieldActive
    this.netDashing = snap.dashing
    // Заряд был и пропал → выстрел: запускаем локальную плавную анимацию сдувания.
    if (this.prevNetWindup > 0.5 && snap.windupProgress === 0) this.netFireTime = Date.now()
    this.prevNetWindup = snap.windupProgress
    this.netWindup = snap.windupProgress
  }

  hasNetTarget() { return this.body.hasNetTarget() }
  nextRemoteTranslation() { return this.body.nextRemoteTranslation() }
  get bodyScale() { return this.body.mesh.scale.x }   // debug: текущий масштаб шара
  get bodyIsVisible() { return this.bodyVisible }     // FP=false (тело скрыто) / TP/соперник=true
  get isRespawning() { return this.respawning }
  respawnProgress() { return Math.max(0, this.respawnTimer / RESPAWN_GHOST_MS) }   // 1→0 остаток фазы

  /** Свой игрок (клиент): запомнить авторитетную позицию из снапшота для реконсиляции. */
  setAuthoritative(pos: THREE.Vector3) { this.body.applyNetTarget(pos) }
  reconcileLocal(next: { x: number; y: number; z: number }) { this.body.reconcileTowardNet(next) }

  /** Косметический выстрел удалённого (клиент, событие FIRED). */
  cosmeticFire(end: THREE.Vector3, hitPoint: THREE.Vector3 | null) {
    this.weapon.playBeam(this.muzzle(), end, hitPoint)
  }

  /** Смерть удалённого по событию KILL (клиент): авторитет уже решил, щит не проверяем. */
  applyDeath() {
    if (!this.alive) return
    this.alive = false
    this.startGhost()
  }

  /** Кадр удалённого игрока на клиенте: только косметика, без боёвки/физики. */
  updateRemote(dt: number, world: World) {
    // phase оружия остаётся idle (beginWindup не зовём) → weapon.update лишь рендерит луч.
    this.weapon.update(dt, { world, muzzle: this.muzzle(), aim: REMOTE_AIM, excludeIds: [this.id] })
    this.body.faceDir(this.netAimDir)   // модель удалённого смотрит по его прицелу (из снапшота)
    this.trail.update(dt, { position: this.body.position, dashing: this.netDashing || this.respawning })
    this.burst.update(dt)
    this.body.tickShader(dt)
    this.applyRemoteVisual()
  }

  private applyRemoteVisual() {
    const mat = this.body.material
    const lc = this.lifecycleVisual()
    if (lc !== null) {   // призрак/материализация (в своём цвете)
      this.body.mesh.scale.setScalar(lc.scale)
      this.body.setOpacity(lc.opacity)   // сфера + кольцо
      mat.color.copy(this.baseColor)
      this.shield.object3d.visible = false
      return
    }
    this.body.setOpacity(1)
    const shrinkP = Math.min((Date.now() - this.netFireTime) / (BOT_WINDUP / 3), 1)   // как в syncVisuals
    if (this.netWindup > 0) {
      this.body.mesh.scale.setScalar(1 + this.netWindup * WINDUP_SCALE_GAIN)
      mat.color.lerpColors(this.baseColor, this.whiteColor, this.netWindup)
    } else if (shrinkP < 1) {
      this.body.mesh.scale.setScalar(1 + WINDUP_SCALE_GAIN * (1 - shrinkP))   // плавное сдувание после выстрела
      mat.color.copy(this.baseColor)
    } else {
      this.body.mesh.scale.setScalar(1)
      mat.color.copy(this.baseColor)
    }
    this.shield.object3d.visible = this.netShieldActive && this.bodyVisible
  }

  dispose() {
    this.weapon.dispose()
    this.shield.dispose()
    this.body.dispose()
    this.trail.dispose()
    this.burst.dispose()
  }
}
