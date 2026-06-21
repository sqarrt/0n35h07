import * as THREE from 'three'
import type { IRespawnFx, RespawnTarget, RespawnFrame } from './types'

// "Swarm": the ball shatters into fragments; ghost is a swarm orbiting the player; rebirth gathers them back.
const FRAGMENTS = 60
const FRAG_SIZE = 0.09             // fragment size (tetrahedron)
const SCATTER_MS = 350             // scatter after death, then orbits
const SCATTER_SPEED = 5            // initial scatter speed
const ORBIT_R_MIN = 0.5            // swarm orbit radii
const ORBIT_R_MAX = 1.3
const ORBIT_SPEED_MIN = 1.6        // angular speeds (rad/s)
const ORBIT_SPEED_MAX = 3.4
const ORBIT_CAPTURE = 0.25         // orbit capture strength after scatter (lerp/frame)
const ORBIT_CAPTURE_MIN = 0.02     // minimal capture during scatter
const BOB_AMP = 0.35               // vertical bobbing
const BOB_HZ = 0.9
const FOLLOW_LERP = 0.12           // how fast the swarm center catches up to origin (per frame)
const GATHER_MS = 280              // rebirth window: swarm gathers into a point (sharp -- no draggy tail)
const GATHER_LERP_BASE = 0.12      // base gather speed + growth with progress
const GATHER_LERP_GAIN = 0.6
const REBIRTH_SCALE_FROM = 0.5     // ball "ignites" from this scale up to 1
const SPIN_Y_FRAC = 0.7            // fragment Y spin -- fraction of X (chaotic tumble)
// Own swarm trail: fading fragment clones along the path (instead of the shared ball trail).
const TRAIL_CLONES = 24
const TRAIL_INTERVAL_MS = 28       // clone emit rate (dense but cheap trail)
const TRAIL_LIFE_MS = 320
const TRAIL_OPACITY = 0.5
const TWO_PI = Math.PI * 2

/** "Swarm" style: orbiting fragments in the player color instead of a translucent ghost. */
export class SwarmRespawnFx implements IRespawnFx {
  readonly object3d = new THREE.Group()
  // The fragments draw the ghost trail themselves (a ball trail would look alien -- the ball is hidden).
  private frags: THREE.Mesh[] = []
  private mat: THREE.MeshBasicMaterial
  private geo: THREE.TetrahedronGeometry
  private trailClones: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number }[] = []
  private trailTimer = 0
  private trailNext = 0           // index of the next clone in the pool (ring buffer)
  private angles: Float32Array      // orbit phase
  private radii: Float32Array
  private speeds: Float32Array
  private heights: Float32Array     // bobbing phase offset
  private scatterVel: THREE.Vector3[] = []
  private sinceDeathMs = Infinity
  private center = new THREE.Vector3()   // damped swarm center (catches up to origin)
  private centerInit = false
  private time = 0
  private dirty = false
  private orbitScratch = new THREE.Vector3()   // orbit point (no per-frame allocations)

  constructor(color: string) {
    this.mat = new THREE.MeshBasicMaterial({ color })
    this.geo = new THREE.TetrahedronGeometry(FRAG_SIZE)
    this.angles = new Float32Array(FRAGMENTS)
    this.radii = new Float32Array(FRAGMENTS)
    this.speeds = new Float32Array(FRAGMENTS)
    this.heights = new Float32Array(FRAGMENTS)
    for (let i = 0; i < FRAGMENTS; i++) {
      const m = new THREE.Mesh(this.geo, this.mat)
      m.userData.noRaycast = true
      this.object3d.add(m)
      this.frags.push(m)
      this.scatterVel.push(new THREE.Vector3())
      this.angles[i] = Math.random() * TWO_PI
      this.radii[i] = ORBIT_R_MIN + Math.random() * (ORBIT_R_MAX - ORBIT_R_MIN)
      this.speeds[i] = ORBIT_SPEED_MIN + Math.random() * (ORBIT_SPEED_MAX - ORBIT_SPEED_MIN)
      this.heights[i] = Math.random() * TWO_PI
    }
    for (let i = 0; i < TRAIL_CLONES; i++) {   // trail pool: per-clone opacity -> own material
      const cmat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
      const clone = new THREE.Mesh(this.geo, cmat)
      clone.userData.noRaycast = true
      clone.visible = false
      this.object3d.add(clone)
      this.trailClones.push({ mesh: clone, mat: cmat, life: 0 })
    }
    this.object3d.visible = false
  }

  onDeath(pos: THREE.Vector3): void {
    this.sinceDeathMs = 0
    this.center.copy(pos)
    this.centerInit = true
    for (let i = 0; i < FRAGMENTS; i++) {
      this.frags[i].position.copy(pos)
      this.scatterVel[i].set((Math.random() - 0.5) * 2, Math.random() - 0.2, (Math.random() - 0.5) * 2)
        .normalize().multiplyScalar(SCATTER_SPEED * (0.5 + Math.random() * 0.5))
    }
  }

  apply(dt: number, t: RespawnTarget, f: RespawnFrame): void {
    this.time += dt
    if (f.ghost !== null) {
      if (!this.centerInit) { this.center.copy(f.origin); this.centerInit = true }
      t.mesh.visible = false                                    // ball hidden -- the swarm marks the player
      this.object3d.visible = f.visible
      this.center.lerp(f.origin, FOLLOW_LERP)                   // swarm catches up to the moving ghost
      this.sinceDeathMs += dt * 1000
      const orbitK = Math.min(this.sinceDeathMs / SCATTER_MS, 1)   // 0 -- scatter, 1 -- pure orbit
      for (let i = 0; i < FRAGMENTS; i++) {
        const m = this.frags[i]
        if (orbitK < 1) m.position.addScaledVector(this.scatterVel[i], dt * (1 - orbitK))
        this.angles[i] += this.speeds[i] * dt
        this.orbitPoint(i, this.radii[i])
        m.position.lerp(this.orbitScratch, Math.max(orbitK * ORBIT_CAPTURE, ORBIT_CAPTURE_MIN))   // smooth capture
        m.rotation.x += dt * this.speeds[i]; m.rotation.y += dt * this.speeds[i] * SPIN_Y_FRAC
      }
      this.stepTrail(dt)   // own trail: fading clones along the fragment paths
      this.dirty = true
      return
    }
    if (this.isRebirthActive(f.sinceRebirthMs)) {
      const k = f.sinceRebirthMs / GATHER_MS                    // 0->1: swarm gathers, ball ignites
      const pop = 1 - (1 - k) ** 2                              // ease-out: ball "flares" right away, no dragging
      this.object3d.visible = f.visible && k < 1
      for (let i = 0; i < FRAGMENTS; i++) this.frags[i].position.lerp(f.origin, Math.min(1, k * GATHER_LERP_GAIN + GATHER_LERP_BASE))
      t.mesh.visible = f.visible
      t.mesh.scale.setScalar(REBIRTH_SCALE_FROM + (1 - REBIRTH_SCALE_FROM) * pop)
      t.setOpacity(1)
      t.material.color.copy(f.baseColor)
      this.dirty = true
      return
    }
    if (this.dirty) {                                           // first frame outside phases -- neutral
      t.mesh.visible = f.visible
      t.setOpacity(1)
      this.object3d.visible = false
      this.sinceDeathMs = Infinity
      this.centerInit = false
      this.dirty = false
    }
  }

  /** Trail emit: every TRAIL_INTERVAL_MS -- a clone at a random fragment's position (fading -- in update). */
  private stepTrail(dt: number) {
    this.trailTimer -= dt * 1000
    if (this.trailTimer > 0) return
    this.trailTimer = TRAIL_INTERVAL_MS
    const src = this.frags[Math.floor(Math.random() * FRAGMENTS)]
    const c = this.trailClones[this.trailNext]
    this.trailNext = (this.trailNext + 1) % TRAIL_CLONES
    c.mesh.position.copy(src.position)
    c.mesh.rotation.copy(src.rotation)
    c.life = TRAIL_LIFE_MS
    c.mesh.visible = true
  }

  /** Fragment orbit point around the damped swarm center -> orbitScratch. */
  private orbitPoint(i: number, r: number): void {
    this.orbitScratch.set(
      this.center.x + Math.cos(this.angles[i]) * r,
      this.center.y + Math.sin(this.time * BOB_HZ * TWO_PI + this.heights[i]) * BOB_AMP,
      this.center.z + Math.sin(this.angles[i]) * r,
    )
  }

  isRebirthActive(sinceRebirthMs: number): boolean {
    return sinceRebirthMs >= 0 && sinceRebirthMs < GATHER_MS
  }

  /** Fading of trail clones -- even outside phases (the tail smolders out after leaving the ghost). */
  update(dt: number): void {
    for (const c of this.trailClones) {
      if (c.life <= 0) continue
      c.life -= dt * 1000
      if (c.life <= 0) { c.mesh.visible = false; c.mat.opacity = 0; continue }
      c.mat.opacity = TRAIL_OPACITY * (c.life / TRAIL_LIFE_MS)
    }
  }

  dispose(): void {
    this.geo.dispose()
    this.mat.dispose()
    this.trailClones.forEach(c => c.mat.dispose())
  }
}
