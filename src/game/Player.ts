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
  MUZZLE_Y, BODY_MESH_Y, BOT_WINDUP, BOT_COLOR_WHITE, RESPAWN_DELAY, EYE_HEIGHT, WINDUP_SCALE_GAIN,
  DEATH_ANIM_MS, SPAWN_ANIM_MS, SPAWN_OVERSHOOT,
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
  respawnTimer = 0
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
  private deathTime = -Infinity   // момент начала сдувания (смерть)
  private spawnTime = -Infinity   // момент начала роста (респаун)
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
  stepVertical(dt: number){ this.body.stepVertical(dt) }
  stepDash(dt: number)    { this.body.stepDash(dt) }
  get dashing()           { return this.body.dashing }
  setGrounded(g: boolean) { this.body.setGrounded(g) }

  /** Кэшируем позицию из физ-тела и двигаем визуальную группу (она в world-space). */
  syncFromBody() {
    this.body.syncFromBody()
    this.bodyGroup.position.copy(this.body.position)
  }

  /** Заморозка: во время готовности/отсчёта движение и действия отключены, камера/прицел — нет. */
  setFrozen(v: boolean) { this.frozen = v }

  // --- IControllable ---
  // Мёртвый/замороженный игрок не действует: тело стоит на месте, пока сдувается/ждёт респауна
  // (иначе мёртвый шар «едет» между смертью и респауном).
  private canAct() { return !this.frozen && this.alive }
  moveIntent(dir: THREE.Vector3, dt: number) { if (!this.canAct()) return; this.body.move(dir, dt) }
  jump()                       { if (!this.canAct()) return; this.body.jump() }
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
    this.weapon.update(dt, { world, muzzle, aim, excludeIds })
    this.shield.update(dt)
    this.syncVisuals()
    this.trail.update(dt, { position: this.body.position, dashing: this.body.dashing })
    this.burst.update(dt)
  }

  private muzzle(): THREE.Vector3 {
    return this.body.position.clone().add(new THREE.Vector3(0, MUZZLE_Y, 0))
  }

  private syncVisuals() {
    if (!this.bodyVisible) this.shield.object3d.visible = false   // в FP пузырь не рисуем
    if (this.weapon.justFired) this.fireTime = Date.now()

    const lc = this.lifecycleScale()
    if (lc !== null) {   // смерть/респаун диктуют масштаб (в своём цвете, без вспышки)
      this.body.mesh.scale.setScalar(lc)
      this.body.material.color.copy(this.baseColor)
      this.shield.object3d.visible = false
      return
    }

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
    if (!this.alive) return 'blocked'        // уже мёртв/сдувается — не добиваем (нет двойного килла)
    if (this.shield.isActive) return 'blocked'
    this.alive = false
    this.respawnTimer = RESPAWN_DELAY
    this.startDeath()
    return 'killed'
  }

  /** Старт анимации смерти: запуск сдувания, выброс частиц, отключение хитбокса. */
  private startDeath() {
    this.deathTime = Date.now()
    this.body.setHittable(false)
    if (this.bodyVisible) this.burst.emit(this.body.position.clone().add(this.bodyMeshOffset))
  }

  respawnAt(pos: THREE.Vector3) {
    this.spawn.copy(pos)
    this.body.setPosition(pos)
    this.weapon.reset()
    this.shield.reset()
    this.alive = true
    this.deathTime = -Infinity
    this.spawnTime = Date.now()        // запускаем рост из нуля с перелётом
    this.respawnTimer = 0
    this.body.setHittable(true)
    this.body.material.color.copy(this.baseColor)
    this.body.mesh.scale.setScalar(0)  // анимация дотянет до 1
  }

  /** Масштаб тела во время смерти/респауна; null — работает обычная windup-логика. */
  private lifecycleScale(): number | null {
    const now = Date.now()
    if (!this.alive) {
      const t = Math.min((now - this.deathTime) / DEATH_ANIM_MS, 1)
      return Math.max(0, 1 - t * t)                     // сдувание, ускоряясь к нулю
    }
    const st = (now - this.spawnTime) / SPAWN_ANIM_MS
    if (st < 1) return this.easeOutBack(Math.max(0, st))   // рост с упругим перелётом за 1.0
    return null
  }

  /** easeOutBack: из 0 в 1 с перелётом выше 1.0 (упругий «отскок»). */
  private easeOutBack(t: number): number {
    const s = SPAWN_OVERSHOOT
    const p = t - 1
    return 1 + (s + 1) * p * p * p + s * p * p
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
    }
  }

  /** Применить снимок к удалённому игроку (клиент): цель позиции + визуальные флаги. */
  applyNetState(snap: PlayerSnapshot) {
    this.body.applyNetTarget(fromVec3(snap.pos))
    this.alive = snap.alive
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
    this.startDeath()
  }

  /** Кадр удалённого игрока на клиенте: только косметика, без боёвки/физики. */
  updateRemote(dt: number, world: World) {
    // phase оружия остаётся idle (beginWindup не зовём) → weapon.update лишь рендерит луч.
    this.weapon.update(dt, { world, muzzle: this.muzzle(), aim: REMOTE_AIM, excludeIds: [this.id] })
    this.trail.update(dt, { position: this.body.position, dashing: this.netDashing })
    this.burst.update(dt)
    this.applyRemoteVisual()
  }

  private applyRemoteVisual() {
    const mat = this.body.material
    const lc = this.lifecycleScale()
    if (lc !== null) {   // смерть/респаун диктуют масштаб (в своём цвете, без вспышки)
      this.body.mesh.scale.setScalar(lc)
      mat.color.copy(this.baseColor)
      this.shield.object3d.visible = false
      return
    }
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
