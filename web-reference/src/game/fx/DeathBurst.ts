import * as THREE from 'three'
import {
  GRAVITY, DEATH_BURST_COUNT, DEATH_BURST_RADIUS,
  DEATH_BURST_LIFE, DEATH_BURST_SPEED, DEATH_BURST_OPACITY,
} from '../../constants'

interface Particle {
  mesh: THREE.Mesh
  mat:  THREE.MeshBasicMaterial
  vel:  THREE.Vector3
  life: number   // remaining life, ms
}

/**
 * Particle burst on death: a pool of additive spheres in the player's color. `emit(pos)` scatters them
 * outward+up, `update` moves them with gravity, fades opacity and shrinks them by life. World-space —
 * lives in `match.root` (like the dash trail), owns its geometry/meshes.
 */
export class DeathBurst {
  readonly object3d = new THREE.Group()
  private geometry: THREE.SphereGeometry
  private particles: Particle[] = []

  constructor(color: THREE.Color) {
    this.geometry = new THREE.SphereGeometry(DEATH_BURST_RADIUS, 8, 8)
    for (let i = 0; i < DEATH_BURST_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const mesh = new THREE.Mesh(this.geometry, mat)
      mesh.visible = false
      mesh.userData.noRaycast = true
      this.object3d.add(mesh)
      this.particles.push({ mesh, mat, vel: new THREE.Vector3(), life: 0 })
    }
  }

  /** Scatter all particles from a point outward (and up). */
  emit(pos: THREE.Vector3) {
    for (const p of this.particles) {
      p.mesh.position.copy(pos)
      p.vel.set(
        (Math.random() - 0.5) * 2 * DEATH_BURST_SPEED,
        Math.random() * DEATH_BURST_SPEED,
        (Math.random() - 0.5) * 2 * DEATH_BURST_SPEED,
      )
      p.life = DEATH_BURST_LIFE
      p.mesh.visible = true
      p.mesh.scale.setScalar(1)
      p.mat.opacity = DEATH_BURST_OPACITY
    }
  }

  update(dt: number) {
    const ms = dt * 1000
    for (const p of this.particles) {
      if (p.life <= 0) continue
      p.life -= ms
      if (p.life <= 0) { p.mesh.visible = false; p.mat.opacity = 0; continue }
      p.vel.y += GRAVITY * dt
      p.mesh.position.addScaledVector(p.vel, dt)
      const t = p.life / DEATH_BURST_LIFE   // 1 → 0
      p.mat.opacity = DEATH_BURST_OPACITY * t
      p.mesh.scale.setScalar(t)
    }
  }

  get aliveCount() { return this.particles.reduce((n, p) => n + (p.life > 0 ? 1 : 0), 0) }

  dispose() {
    this.geometry.dispose()
    this.particles.forEach(p => p.mat.dispose())
  }
}
