import * as THREE from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import type { IControllable, IWeapon, IShield } from './abstractions'
import type { World } from './World'
import { Body } from './Body'
import {
  MUZZLE_Y, BODY_MESH_Y, BOT_WINDUP, BOT_COLOR_WHITE, RESPAWN_DELAY, EYE_HEIGHT,
} from '../constants'

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
  readonly id: number
  readonly team: number
  readonly bodyGroup = new THREE.Group()
  readonly spawn = new THREE.Vector3(0, EYE_HEIGHT, 0)

  private body: Body
  private weapon: IWeapon
  private shield: IShield
  private aimPoint = new THREE.Vector3(0, EYE_HEIGHT, -100)
  private isFlashing = false
  private bodyVisible = true
  private fireTime = -Infinity
  private baseColor: THREE.Color
  private whiteColor = new THREE.Color(BOT_COLOR_WHITE)

  constructor(
    id: number,
    team: number,
    body: Body,
    weapon: IWeapon,
    shield: IShield,
    color: string,
  ) {
    this.id = id
    this.team = team
    this.body = body
    this.weapon = weapon
    this.shield = shield
    this.baseColor = new THREE.Color(color)
    shield.object3d.position.set(0, BODY_MESH_Y, 0)   // локально — едет с телом
    this.bodyGroup.add(body.object3d, shield.object3d)
    // Стабильная ссылка для ref={p.bindBody}: иначе инлайн-ref пере-привязывается
    // каждый кадр (App ре-рендерит на HUD) и ломает bound → двойной трансформ хитбокса.
    this.bindBody = this.bindBody.bind(this)
  }

  /** Луч — world-space, рендерится отдельно (вне RigidBody). */
  get weaponObject() { return this.weapon.object3d }

  // --- Rapier binding (RigidBody = только коллайдер; визуал отдельно в world-space) ---
  bindBody(rb: RapierRigidBody | null) {
    if (!rb) { this.body.unbind(); return }
    this.body.bindBody(rb)
  }
  get rb() { return this.body.rb }
  consumeDesired()        { return this.body.consumeDesired() }
  consumeTeleport()       { return this.body.consumeTeleport() }
  stepVertical(dt: number){ this.body.stepVertical(dt) }
  setGrounded(g: boolean) { this.body.setGrounded(g) }

  /** Кэшируем позицию из физ-тела и двигаем визуальную группу (она в world-space). */
  syncFromBody() {
    this.body.syncFromBody()
    this.bodyGroup.position.copy(this.body.position)
  }

  // --- IControllable ---
  moveIntent(dir: THREE.Vector3, dt: number) { this.body.move(dir, dt) }
  jump()                       { this.body.jump() }
  aim(point: THREE.Vector3)    { this.aimPoint.copy(point) }   // целимся В ТОЧКУ мира
  startFiring()                { this.weapon.beginWindup() }
  activateShield()             { this.shield.activate() }

  // --- simulation (без интеграции позиции — её делает Rapier KCC в Match.applyPhysics) ---
  update(dt: number, world: World, excludeIds: number[]) {
    const muzzle = this.muzzle()
    const aim = this.aimPoint.clone().sub(muzzle).normalize()  // луч сходится в точку прицела
    this.weapon.update(dt, { world, muzzle, aim, excludeIds })
    this.shield.update(dt)
    this.syncVisuals()
  }

  private muzzle(): THREE.Vector3 {
    return this.body.position.clone().add(new THREE.Vector3(0, MUZZLE_Y, 0))
  }

  private syncVisuals() {
    if (!this.bodyVisible) this.shield.object3d.visible = false   // в FP пузырь не рисуем
    if (this.weapon.justFired) this.fireTime = Date.now()
    if (this.isFlashing) return

    const wp = this.weapon.windupProgress
    const shrinkP = Math.min((Date.now() - this.fireTime) / (BOT_WINDUP / 3), 1)
    const mat = this.body.material
    if (wp > 0) {
      this.body.mesh.scale.setScalar(1 + wp * 0.4)
      mat.color.lerpColors(this.baseColor, this.whiteColor, wp)
    } else if (shrinkP < 1) {
      this.body.mesh.scale.setScalar(1 + 0.4 * (1 - shrinkP))
      mat.color.copy(this.baseColor)
    } else {
      this.body.mesh.scale.setScalar(1)
      mat.color.copy(this.baseColor)
    }
  }

  // --- combat (driven by Match, never self-respawn) ---
  receiveHit(): 'blocked' | 'killed' {
    if (this.shield.isActive) return 'blocked'
    this.alive = false
    this.isFlashing = true
    this.body.material.color.set('red')
    this.respawnTimer = RESPAWN_DELAY
    return 'killed'
  }

  respawnAt(pos: THREE.Vector3) {
    this.spawn.copy(pos)
    this.body.setPosition(pos)
    this.weapon.reset()
    this.shield.reset()
    this.alive = true
    this.isFlashing = false
    this.respawnTimer = 0
    this.body.material.color.copy(this.baseColor)
    this.body.mesh.scale.setScalar(1)
  }

  setBodyVisible(v: boolean) { this.bodyVisible = v; this.body.setVisible(v) }
  spawnImpact(point: THREE.Vector3) { this.weapon.spawnImpact(point) }

  // --- getters for Match / HUD / debug ---
  get position()            { return this.body.position }
  get isWindingUp()         { return this.weapon.isWindingUp }
  get windupProgress()      { return this.weapon.windupProgress }
  beamCooldownProgress()    { return this.weapon.cooldownProgress() }
  shieldProgress()          { return this.shield.progress() }
  get shieldActive()        { return this.shield.isActive }
  get weaponJustFired()     { return this.weapon.justFired }
  get fireOutcome()         { return this.weapon.outcome }
  clearJustFired()          { this.weapon.clearJustFired() }

  dispose() {
    this.weapon.dispose()
    this.shield.dispose()
    this.body.dispose()
  }
}
