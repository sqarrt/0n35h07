import * as THREE from 'three'
import type { IWeapon, WeaponContext, FireOutcome } from './abstractions'
import { BEAM_WINDUP, BEAM_COOLDOWN, BEAM_DURATION, GRAVITY } from '../constants'

interface BeamConfig {
  windupDuration?:   number
  cooldownDuration?: number
  beamDuration?:     number
  innerColor?:       string
  outerColor?:       string
}

interface Particle { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }
const UP = new THREE.Vector3(0, 1, 0)

/** Луч: idle → windup → fire → cooldown (dt-driven). Владеет мешами луча/afterglow/частиц. */
export class BeamWeapon implements IWeapon {
  readonly object3d = new THREE.Group()
  private beamGroup = new THREE.Group()
  private afterglowMesh: THREE.Mesh
  private particles: Particle[] = []
  private mats: THREE.Material[] = []

  private phase: 'idle' | 'windup' | 'cooldown' = 'idle'
  private windupElapsed = 0
  private cooldownRemaining = 0
  private readonly windupDuration: number
  private readonly cooldownDuration: number
  private readonly beamDuration: number

  private beamActive = false
  private beamFireElapsed = 0
  private start = new THREE.Vector3()
  private end = new THREE.Vector3()
  private afterglowOpacity = 0

  justFired = false
  outcome: FireOutcome | null = null

  constructor(cfg: BeamConfig = {}) {
    this.windupDuration   = cfg.windupDuration   ?? BEAM_WINDUP
    this.cooldownDuration = cfg.cooldownDuration ?? BEAM_COOLDOWN
    this.beamDuration     = cfg.beamDuration     ?? BEAM_DURATION

    const innerMat = new THREE.MeshBasicMaterial({ color: cfg.innerColor ?? 'white' })
    const outerMat = new THREE.MeshBasicMaterial({
      color: cfg.outerColor ?? '#0ff', transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), innerMat)
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1, 8), outerMat)
    inner.userData.noRaycast = true
    outer.userData.noRaycast = true
    this.beamGroup.add(inner, outer)
    this.beamGroup.visible = false

    const aMat = new THREE.MeshBasicMaterial({
      color: cfg.outerColor ?? '#0ff', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    this.afterglowMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), aMat)
    this.afterglowMesh.userData.noRaycast = true
    this.afterglowMesh.visible = false

    const pMat = new THREE.MeshBasicMaterial({ color: '#ff0' })
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 4, 4), pMat)
      m.userData.noRaycast = true
      m.visible = false
      this.particles.push({ mesh: m, vel: new THREE.Vector3(), life: 0 })
    }
    this.object3d.add(this.beamGroup, this.afterglowMesh, ...this.particles.map(p => p.mesh))
    this.mats.push(innerMat, outerMat, aMat, pMat)
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
    this.renderBeam(ms)
    this.renderAfterglow(dt)
    this.renderParticles(dt)
  }

  private fire(ctx: WeaponContext) {
    this.phase = 'cooldown'
    this.cooldownRemaining = this.cooldownDuration
    this.windupElapsed = 0

    const origin = ctx.muzzle.clone()
    const dir = ctx.aim.clone().normalize()
    const hit = ctx.world.raycast(origin, dir, ctx.excludeIds)

    let hitEntityId: number | null = null
    let hitPoint: THREE.Vector3 | null = null
    if (hit) {
      this.end.copy(hit.point)
      const eid = hit.object.userData.entityId
      if (eid !== undefined) { hitEntityId = eid; hitPoint = hit.point.clone() }
    } else {
      this.end.copy(origin).addScaledVector(dir, 100)
    }
    this.start.copy(origin)
    this.beamActive = true
    this.beamFireElapsed = 0
    this.afterglowOpacity = 0.5
    this.outcome = { end: this.end.clone(), hitEntityId, hitPoint }
    this.justFired = true
  }

  private renderBeam(ms: number) {
    if (!this.beamActive) { this.beamGroup.visible = false; return }
    this.beamFireElapsed += ms
    const t = Math.min(this.beamFireElapsed / this.beamDuration, 1)
    if (t >= 1) { this.beamActive = false; this.beamGroup.visible = false; return }
    const dir = this.end.clone().sub(this.start)
    const len = dir.length()
    this.beamGroup.position.copy(this.start).lerp(this.end, 0.5)
    this.beamGroup.quaternion.setFromUnitVectors(UP, dir.normalize())
    this.beamGroup.scale.set(1 - t, len, 1 - t)
    this.beamGroup.visible = true
  }

  private renderAfterglow(dt: number) {
    if (this.afterglowOpacity <= 0) { this.afterglowMesh.visible = false; return }
    this.afterglowOpacity -= dt * 1.8
    if (this.afterglowOpacity <= 0) { this.afterglowMesh.visible = false; return }
    const dir = this.end.clone().sub(this.start)
    const len = dir.length()
    this.afterglowMesh.position.copy(this.start).lerp(this.end, 0.5)
    this.afterglowMesh.quaternion.setFromUnitVectors(UP, dir.normalize())
    this.afterglowMesh.scale.set(1, len, 1)
    ;(this.afterglowMesh.material as THREE.MeshBasicMaterial).opacity = this.afterglowOpacity * 0.4
    this.afterglowMesh.visible = true
  }

  private renderParticles(dt: number) {
    for (const p of this.particles) {
      if (p.life <= 0) { p.mesh.visible = false; continue }
      p.mesh.position.addScaledVector(p.vel, dt)
      p.vel.y += GRAVITY * dt
      p.life -= dt * 3
      p.mesh.scale.setScalar(Math.max(0, p.life) * 0.15)
      p.mesh.visible = p.life > 0
    }
  }

  spawnImpact(point: THREE.Vector3) {
    for (const p of this.particles) {
      p.mesh.position.copy(point)
      p.vel.set((Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8)
      p.life = 1
    }
  }

  reset() {
    this.phase = 'idle'
    this.windupElapsed = 0
    this.cooldownRemaining = 0
    this.beamActive = false
    this.afterglowOpacity = 0
    this.justFired = false
    this.outcome = null
    this.beamGroup.visible = false
    this.afterglowMesh.visible = false
    this.particles.forEach(p => { p.life = 0; p.mesh.visible = false })
  }

  get isWindingUp() { return this.phase === 'windup' }
  get windupProgress() {
    return this.phase === 'windup' ? Math.min(this.windupElapsed / this.windupDuration, 1) : 0
  }
  cooldownProgress() {
    return this.phase === 'cooldown'
      ? Math.max(0, 1 - this.cooldownRemaining / this.cooldownDuration)
      : 1
  }
  clearJustFired() { this.justFired = false }

  dispose() {
    this.beamGroup.children.forEach(c => (c as THREE.Mesh).geometry.dispose())
    this.afterglowMesh.geometry.dispose()
    this.particles.forEach(p => p.mesh.geometry.dispose())
    this.mats.forEach(m => m.dispose())
  }
}
