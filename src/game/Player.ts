import * as THREE from 'three'
import type { IControllable, IWeapon, IShield } from './abstractions'
import type { World } from './World'
import { Body } from './Body'
import {
  MUZZLE_Y, BODY_MESH_Y, BOT_WINDUP, BOT_COLOR_WHITE, RESPAWN_DELAY,
  WINDUP_MOVE_FACTOR, EYE_HEIGHT,
} from '../constants'

/**
 * Единая сущность игрока — и человек, и бот, и сетевой игрок. Компонует тело, оружие и
 * щит (инжектятся → DIP). Контроллеры дёргают intent-методы. Сам себя НЕ респавнит.
 */
export class Player implements IControllable {
  alive = true
  respawnTimer = 0
  readonly object3d = new THREE.Group()
  readonly id: number
  readonly team: number

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
    this.object3d.add(body.object3d, weapon.object3d, shield.object3d)
  }

  // --- IControllable ---
  moveIntent(dir: THREE.Vector3, dt: number) { this.body.move(dir, dt) }
  jump()                       { this.body.jump() }
  aim(point: THREE.Vector3)    { this.aimPoint.copy(point) }   // целимся В ТОЧКУ мира
  startFiring()                { this.weapon.beginWindup() }
  activateShield()             { this.shield.activate() }

  // --- simulation ---
  update(dt: number, world: World, excludeIds: number[]) {
    // Во время заряда вся физика (вкл. падение) замедляется — как и движение.
    this.body.update(dt * (this.weapon.isWindingUp ? WINDUP_MOVE_FACTOR : 1))
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
    this.shield.object3d.position.copy(this.body.position).y += BODY_MESH_Y
    // В FP (тело скрыто) пузырь щита не рисуем — он обернул бы камеру; щит при этом
    // продолжает блокировать попадания, индикация идёт через HUD.
    if (!this.bodyVisible) this.shield.object3d.visible = false
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
