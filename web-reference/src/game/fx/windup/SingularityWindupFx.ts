import * as THREE from 'three'
import { BALL_RADIUS } from '../../../constants'
import type { IWindupFx, WindupTarget, WindupFrame } from './types'

// --- Ball: shrink + darkening (inverse of the default). ---
const SING_SHRINK = 0.35              // max shrink (scale fraction) at peak charge
const SING_DARK = '#05050d'           // near-black with a cold tint

// --- Accretion vortex: particles spiral inward into the ball. ---
const SING_PARTICLES = 48
const SING_R_MAX = BALL_RADIUS * 3.2  // particle spawn radius
const SING_R_MIN = BALL_RADIUS * 0.7  // absorption radius (inside the ball)
const SING_SPIN_MIN = 2.4             // angular speed (rad/s) at charge start
const SING_SPIN_GAIN = 3.2            // gain at peak
const SING_PULL = 1.4                 // inward pull speed: fraction of R_MAX per second at peak
const SING_DISC_H = BALL_RADIUS * 1.6 // disc height (flattens toward the center)
const SING_SIZE = BALL_RADIUS * 0.16  // particle size
const SING_OPACITY = 0.9
const SING_APPEAR_FRAC = 0.2          // fraction of charge over which the vortex fades in
const SING_COLOR = '#aaccff'

// --- Collapse flash at the moment of firing. ---
const FLASH_COLOR = '#ffffff'
const FLASH_FRAC = 0.45               // fraction of the deflate phase over which the flash fades
const FLASH_SCALE = 2.6               // final flash scale (relative to ball radius)
const FLASH_OPACITY = 0.8
const FLASH_SEGMENTS = 8              // an ephemeral additive sphere needs no more (cf. DeathBurst)

/** "Singularity": the ball collapses, surrounded by a glowing vortex of absorbed particles; firing = a flash. */
export class SingularityWindupFx implements IWindupFx {
  readonly object3d = new THREE.Group()
  private points: THREE.Points
  private pmat: THREE.PointsMaterial
  private positions: Float32Array
  private angles: Float32Array
  private radii: Float32Array
  private heights: Float32Array
  private dark = new THREE.Color(SING_DARK)
  private flash: THREE.Mesh
  private fmat: THREE.MeshBasicMaterial

  constructor() {
    this.positions = new Float32Array(SING_PARTICLES * 3)
    this.angles = new Float32Array(SING_PARTICLES)
    this.radii = new Float32Array(SING_PARTICLES)
    this.heights = new Float32Array(SING_PARTICLES)
    for (let i = 0; i < SING_PARTICLES; i++) this.resetParticle(i, true)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.pmat = new THREE.PointsMaterial({
      color: SING_COLOR, size: SING_SIZE, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
    this.points = new THREE.Points(geo, this.pmat)
    this.points.userData.noRaycast = true
    this.fmat = new THREE.MeshBasicMaterial({
      color: FLASH_COLOR, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, FLASH_SEGMENTS, FLASH_SEGMENTS), this.fmat)
    this.flash.userData.noRaycast = true
    this.flash.visible = false
    this.object3d.add(this.points, this.flash)
    this.object3d.visible = false
  }

  /** New particle orbit. randomRadius — initial fill of the whole disc (not a ring). */
  private resetParticle(i: number, randomRadius = false) {
    this.angles[i] = Math.random() * Math.PI * 2
    this.radii[i] = randomRadius ? SING_R_MIN + Math.random() * (SING_R_MAX - SING_R_MIN) : SING_R_MAX
    this.heights[i] = (Math.random() - 0.5) * SING_DISC_H
  }

  apply(dt: number, t: WindupTarget, f: WindupFrame): void {
    const charging = f.progress > 0
    const flashing = !charging && f.shrink < 1
    this.object3d.visible = (charging || flashing) && f.visible
    this.object3d.position.copy(f.origin)

    if (charging) {
      t.mesh.scale.setScalar(1 - SING_SHRINK * f.progress)
      t.material.color.lerpColors(f.baseColor, this.dark, f.progress)
      this.stepVortex(dt, f.progress)
      this.flash.visible = false
    } else if (flashing) {
      t.mesh.scale.setScalar(1 - SING_SHRINK * (1 - f.shrink))   // return to normal
      t.material.color.copy(f.baseColor)
      this.pmat.opacity = 0
      this.points.visible = false
      const k = Math.min(f.shrink / FLASH_FRAC, 1)               // 0→1 — flash expands and fades
      this.flash.visible = k < 1
      this.flash.scale.setScalar(1 + (FLASH_SCALE - 1) * k)
      this.fmat.opacity = FLASH_OPACITY * (1 - k)
    } else {
      t.mesh.scale.setScalar(1)
      t.material.color.copy(f.baseColor)
      this.pmat.opacity = 0
      this.points.visible = false
      this.flash.visible = false
    }
    t.material.emissive.setScalar(0)
  }

  /** Vortex step: spiral inward; absorbed particles respawn at the outer radius. */
  private stepVortex(dt: number, progress: number) {
    this.points.visible = true
    this.pmat.opacity = SING_OPACITY * Math.min(progress / SING_APPEAR_FRAC, 1)
    const spin = SING_SPIN_MIN + SING_SPIN_GAIN * progress
    const pull = SING_PULL * progress * SING_R_MAX
    for (let i = 0; i < SING_PARTICLES; i++) {
      this.angles[i] += spin * dt
      this.radii[i] -= pull * dt
      if (this.radii[i] < SING_R_MIN) this.resetParticle(i)
      const r = this.radii[i]
      const squash = r / SING_R_MAX                              // disc flattens toward the center
      this.positions[i * 3]     = Math.cos(this.angles[i]) * r
      this.positions[i * 3 + 1] = this.heights[i] * squash
      this.positions[i * 3 + 2] = Math.sin(this.angles[i]) * r
    }
    ;(this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    this.points.geometry.dispose()
    this.pmat.dispose()
    this.flash.geometry.dispose()
    this.fmat.dispose()
  }
}
