import * as THREE from 'three'
import type { IWeapon, WeaponContext, FireOutcome } from './abstractions'
import type { MeshUserData } from '../utils/raycast'
import { BEAM_WINDUP, BEAM_COOLDOWN, BEAM_DURATION, GRAVITY, AIM_RANGE } from '../constants'
import { ClassicBeamFx } from './fx/beam/ClassicBeamFx'
import type { IBeamFx } from './fx/beam/types'

interface BeamConfig {
  windupDuration?:   number
  cooldownDuration?: number
  beamDuration?:     number
  innerColor?:       string
  outerColor?:       string
  beamFx?:           IBeamFx   // стилевой визуал луча; нет → классический (цвета выше)
}

interface Particle { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }

// Импакт-частицы (общие для всех стилей луча).
const IMPACT_PARTICLES = 6
const IMPACT_LIFE_DECAY = 3      // скорость угасания жизни (ед/с)
const IMPACT_SCALE = 0.15        // размер частицы = life * IMPACT_SCALE
const IMPACT_SPREAD_H = 8        // горизонтальный разброс скорости
const IMPACT_SPREAD_V = 6        // вертикальный разброс скорости

/** Луч: idle → windup → fire → cooldown (dt-driven). Визуал луча — инжектируемый IBeamFx (стилевой). */
export class BeamWeapon implements IWeapon {
  readonly object3d = new THREE.Group()
  private beamFx: IBeamFx
  private particles: Particle[] = []
  private particleMat: THREE.MeshBasicMaterial

  private phase: 'idle' | 'windup' | 'cooldown' = 'idle'
  private windupElapsed = 0
  private cooldownRemaining = 0
  private cooldownScale = 1
  private cooldownTotal = BEAM_COOLDOWN   // фактическая длительность текущего кулдауна (для progress)
  private readonly windupDuration: number
  private readonly cooldownDuration: number

  justFired = false
  outcome: FireOutcome | null = null
  private _origin = new THREE.Vector3()
  private _dir    = new THREE.Vector3()
  private _end    = new THREE.Vector3()
  private _rcDir  = new THREE.Vector3()
  private _tmp    = new THREE.Vector3()

  constructor(cfg: BeamConfig = {}) {
    this.windupDuration   = cfg.windupDuration   ?? BEAM_WINDUP
    this.cooldownDuration = cfg.cooldownDuration ?? BEAM_COOLDOWN
    this.beamFx = cfg.beamFx ?? new ClassicBeamFx(cfg.innerColor ?? 'white', cfg.outerColor ?? '#0ff', cfg.beamDuration ?? BEAM_DURATION)

    this.particleMat = new THREE.MeshBasicMaterial({ color: '#ff0' })
    for (let i = 0; i < IMPACT_PARTICLES; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 4, 4), this.particleMat)
      m.userData.noRaycast = true
      m.visible = false
      this.particles.push({ mesh: m, vel: new THREE.Vector3(), life: 0 })
    }
    this.object3d.add(this.beamFx.object3d, ...this.particles.map(p => p.mesh))
  }

  beginWindup() {
    if (this.phase !== 'idle') return
    this.phase = 'windup'
    this.windupElapsed = 0
  }

  update(dt: number, ctx: WeaponContext) {
    const ms = dt * 1000
    if (this.phase === 'windup') {
      this.windupElapsed += ms
      if (this.windupElapsed >= this.windupDuration) this.fire(ctx)
    } else if (this.phase === 'cooldown') {
      this.cooldownRemaining -= ms
      if (this.cooldownRemaining <= 0) { this.cooldownRemaining = 0; this.phase = 'idle' }
    }
    this.beamFx.update(dt)
    this.renderParticles(dt)
  }

  private fire(ctx: WeaponContext) {
    this.phase = 'cooldown'
    this.cooldownTotal = this.cooldownDuration * this.cooldownScale
    this.cooldownRemaining = this.cooldownTotal
    this.windupElapsed = 0

    this._origin.copy(ctx.muzzle)            // визуал луча всегда из дула
    this._dir.copy(ctx.aim).normalize()      // визуальное направление (дуло→прицел), для fallback
    // Хит: по лучу прицела (камера→мушка) у человека — «что под перекрестием, то и поражаешь», без
    // параллакса дуло↔камера в TP. Бот/удалённый origin не задают → хит из дула вдоль aim (как раньше).
    const rcOrigin = ctx.hitOrigin ?? this._origin
    const rcDir = ctx.hitDir ? this._rcDir.copy(ctx.hitDir).normalize() : this._dir
    const hit = ctx.world.raycast(rcOrigin, rcDir, ctx.excludeIds, ctx.pierceWalls ?? false)

    let hitEntityId: number | null = null
    let hitPoint: THREE.Vector3 | null = null
    if (hit) {
      const eid = (hit.object.userData as MeshUserData).entityId
      if (eid !== undefined) { hitEntityId = eid; hitPoint = hit.point.clone() }
      // Конец визуала = точка попадания, если она ВПЕРЕДИ дула; иначе тянем луч вперёд (анти-переворот в TP,
      // когда прицел зацепил поверхность между камерой и дулом).
      const ahead = this._tmp.copy(hit.point).sub(this._origin).dot(this._dir) > 0
      if (ahead) this._end.copy(hit.point)
      else this._end.copy(this._origin).addScaledVector(this._dir, AIM_RANGE)
    } else {
      this._end.copy(this._origin).addScaledVector(this._dir, AIM_RANGE)
    }
    this.beamFx.play(this._origin, this._end)   // play делает .copy() на обоих аргументах → scratch безопасен
    this.outcome = { end: this._end.clone(), hitEntityId, hitPoint }   // clone: outcome переживает кадр
    this.justFired = true
  }

  private renderParticles(dt: number) {
    for (const p of this.particles) {
      if (p.life <= 0) { p.mesh.visible = false; continue }
      p.mesh.position.addScaledVector(p.vel, dt)
      p.vel.y += GRAVITY * dt
      p.life -= dt * IMPACT_LIFE_DECAY
      p.mesh.scale.setScalar(Math.max(0, p.life) * IMPACT_SCALE)
      p.mesh.visible = p.life > 0
    }
  }

  /** Косметический выстрел без raycast — для удалённого игрока на клиенте (событие FIRED). */
  playBeam(start: THREE.Vector3, end: THREE.Vector3, hitPoint?: THREE.Vector3 | null) {
    this.beamFx.play(start, end)
    if (hitPoint) this.spawnImpact(hitPoint)
  }

  spawnImpact(point: THREE.Vector3) {
    for (const p of this.particles) {
      p.mesh.position.copy(point)
      p.vel.set((Math.random() - 0.5) * IMPACT_SPREAD_H, Math.random() * IMPACT_SPREAD_V, (Math.random() - 0.5) * IMPACT_SPREAD_H)
      p.life = 1
    }
  }

  /** Отменяет заряд (windup) БЕЗ выстрела и возвращает в idle: кулдаун НЕ начисляется,
   *  т.к. луча не было (можно сразу заряжать снова). Вне windup — no-op. */
  interrupt() {
    if (this.phase !== 'windup') return
    this.phase = 'idle'
    this.windupElapsed = 0
  }

  reset() {
    this.phase = 'idle'
    this.windupElapsed = 0
    this.cooldownRemaining = 0
    this.justFired = false
    this.outcome = null
    this.beamFx.reset()
    this.particles.forEach(p => { p.life = 0; p.mesh.visible = false })
  }

  get isWindingUp() { return this.phase === 'windup' }
  get windupProgress() {
    return this.phase === 'windup' ? Math.min(this.windupElapsed / this.windupDuration, 1) : 0
  }
  cooldownProgress() {
    return this.phase === 'cooldown'
      ? Math.max(0, 1 - this.cooldownRemaining / this.cooldownTotal)
      : 1
  }
  setCooldownScale(scale: number) { this.cooldownScale = scale > 0 ? scale : 1 }
  resetCooldown() {
    this.cooldownRemaining = 0
    if (this.phase === 'cooldown') this.phase = 'idle'
  }
  clearJustFired() { this.justFired = false }

  dispose() {
    this.beamFx.dispose()
    this.particles.forEach(p => p.mesh.geometry.dispose())
    this.particleMat.dispose()
  }
}
