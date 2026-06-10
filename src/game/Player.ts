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
  MUZZLE_Y, BODY_MESH_Y, EYE_HEIGHT, WINDUP_SHRINK_MS,
  SPAWN_ANIM_MS, SPAWN_POP, RESPAWN_GHOST_MS, RESPAWN_SPEED_MULT, RESPAWN_SPEED_RAMP, GHOST_OPACITY,
} from '../constants'
import type { WindupStyle } from '../constants'
import { ClassicWindupFx } from './fx/windup/ClassicWindupFx'
import type { IWindupFx, WindupTarget, WindupFrame } from './fx/windup/types'

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
  private lookDir = new THREE.Vector3(0, 0, -1)   // направление ВЗГЛЯДА (ориентация модели): стабильно, не зависит
  //                                                 от дальности точки прицела (в TP камера позади → aimPoint−muzzle переворачивался)
  private spawnTime = -Infinity   // момент начала материализации (респаун)
  private bodyMeshOffset = new THREE.Vector3(0, BODY_MESH_Y, 0)   // центр сферы относительно глаз
  private bodyVisible = true
  private frozen = false   // готовность/отсчёт перед боем — намерения подавлены
  private fireTime = -Infinity
  private baseColor: THREE.Color
  readonly windupStyle: WindupStyle
  private windupFx: IWindupFx
  private windupTarget: WindupTarget
  private windupFrame: WindupFrame
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
    windupFx: IWindupFx = new ClassicWindupFx(),
    windupStyle: WindupStyle = 'classic',
  ) {
    this.id = id
    this.body = body
    this.weapon = weapon
    this.shield = shield
    this.baseColor = new THREE.Color(color)
    this.windupFx = windupFx
    this.windupStyle = windupStyle
    this.windupTarget = { mesh: body.mesh, material: body.material }
    this.windupFrame = {
      progress: 0, shrink: 1, baseColor: this.baseColor,
      aimDir: new THREE.Vector3(0, 0, -1), origin: new THREE.Vector3(), visible: true,
    }
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

  /** World-space часть анимации заряда (челюсти/вихрь) — живёт в match.root, как trail/burst. */
  get windupFxObject() { return this.windupFx.object3d }

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
  get justJumped()        { return this.body.justJumped }
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
  /** Направление взгляда (для ориентации модели). Горизонтальную проекцию берёт faceDir; почти-нулевой вектор игнорим. */
  setLook(dir: THREE.Vector3)  { if (dir.lengthSq() > 1e-8) this.lookDir.copy(dir) }
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
    this.body.faceDir(this.lookDir)   // модель ориентируется по ВЗГЛЯДУ (не по точке прицела — иначе в TP yaw скачет)
    this.weapon.update(dt, { world, muzzle, aim, excludeIds })
    this.shield.update(dt)
    this.syncVisuals(dt)
    this.trail.update(dt, { position: this.body.position, dashing: this.body.dashing || this.respawning })
    this.burst.update(dt)
    this.body.tickShader(dt)
  }

  private muzzle(): THREE.Vector3 {
    return this.body.position.clone().add(new THREE.Vector3(0, MUZZLE_Y, 0))
  }

  private syncVisuals(dt: number) {
    if (!this.bodyVisible) this.shield.object3d.visible = false   // в FP пузырь не рисуем
    if (this.weapon.justFired) this.fireTime = Date.now()

    if (this.respawning) {   // фаза призрака: полупрозрачный, заряд скрыт
      this.body.mesh.scale.setScalar(1)
      this.body.setOpacity(GHOST_OPACITY)
      this.body.material.color.copy(this.baseColor)
      this.shield.object3d.visible = false
      this.windupFx.object3d.visible = false   // призрак не заряжает — проекцию скрыть
      return
    }
    const lc = this.lifecycleVisual()
    this.body.setOpacity(lc !== null ? lc.opacity : 1)
    // applyWindup управляет масштабом/цветом через стратегию; пуф корректирует масштаб поверх
    this.applyWindup(dt, this.weapon.windupProgress, this.fireTime, this.lookDir)
    if (lc !== null) {   // пуф материализации: корректируем масштаб поверх windup (свой цвет уже выставлен fx)
      this.body.mesh.scale.setScalar(lc.scale)
      this.body.material.color.copy(this.baseColor)
      this.shield.object3d.visible = false
    }
  }

  /** Общий путь анимации заряда для локального (weapon/lookDir) и сетевого (netWindup/netAimDir) игрока. */
  private applyWindup(dt: number, progress: number, fireTime: number, aimDir: THREE.Vector3) {
    const f = this.windupFrame
    f.progress = progress
    f.shrink = Math.min((Date.now() - fireTime) / WINDUP_SHRINK_MS, 1)
    f.aimDir.copy(aimDir)
    f.origin.copy(this.body.position).add(this.bodyMeshOffset)
    f.visible = this.bodyVisible
    this.windupFx.apply(dt, this.windupTarget, f)
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

  /** Масштаб+прозрачность анимации пуфа после материализации; null — обычная windup-логика.
   *  Призрак обрабатывается раньше (ранний return в вызывающих методах) — здесь не проверяется. */
  private lifecycleVisual(): { scale: number; opacity: number } | null {
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
      aimDir: toVec3(this.lookDir),   // направление взгляда (ориентация модели у соперника); стабильнее точки прицела
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
    this.applyRemoteVisual(dt)
  }

  private applyRemoteVisual(dt: number) {
    if (this.respawning) {   // фаза призрака: полупрозрачный, заряд скрыт
      this.body.mesh.scale.setScalar(1)
      this.body.setOpacity(GHOST_OPACITY)
      this.body.material.color.copy(this.baseColor)
      this.shield.object3d.visible = false
      this.windupFx.object3d.visible = false
      return
    }
    const lc = this.lifecycleVisual()
    this.body.setOpacity(lc !== null ? lc.opacity : 1)
    // Порядок как в syncVisuals: сначала windup (масштаб/цвет), затем пуф перезаписывает масштаб поверх.
    this.applyWindup(dt, this.netWindup, this.netFireTime, this.netAimDir)
    if (lc !== null) {   // пуф материализации: масштаб пуфа побеждает, щит скрыт
      this.body.mesh.scale.setScalar(lc.scale)
      this.body.material.color.copy(this.baseColor)
      this.shield.object3d.visible = false
    } else {
      this.shield.object3d.visible = this.netShieldActive && this.bodyVisible
    }
  }

  dispose() {
    this.weapon.dispose()
    this.shield.dispose()
    this.body.dispose()
    this.trail.dispose()
    this.burst.dispose()
    this.windupFx.dispose()
  }
}
