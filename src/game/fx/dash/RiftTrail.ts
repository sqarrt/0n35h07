import * as THREE from 'three'
import type { IDashTrail, DashTrailContext } from '../../abstractions'
import { BALL_RADIUS, BODY_MESH_Y } from '../../../constants'

// RIFT: dash leaves RGB triplet copies of the ball (chromatic glitch shift),
// copies flicker at a limited rate (photosensitivity) and fade quickly.
const RIFT_INTERVAL_MS    = 40    // ms between triplets
const RIFT_LIFE_MS        = 260   // triplet lifetime, ms
const RIFT_POOL           = 8     // triplet pool
const RIFT_RADIUS         = BALL_RADIUS * 0.95
const RIFT_OFFSET         = 0.12  // lateral spread of color channels
const RIFT_OPACITY        = 0.35  // base copy opacity
const FLICKER_INTERVAL_MS = 110   // flicker period (<= ~9 Hz)
const FLICKER_DIM         = 0.4   // opacity multiplier in the "dim" phase
const RIFT_CHANNELS = ['#f33', '#3f3', '#33f'] as const   // R / G / B

const UP = new THREE.Vector3(0, 1, 0)

interface Triplet {
  meshes: THREE.Mesh[]
  mats:   THREE.MeshBasicMaterial[]
  life:   number   // remaining life, ms
}

export class RiftTrail implements IDashTrail {
  readonly object3d = new THREE.Group()
  private geometry: THREE.SphereGeometry
  private triplets: Triplet[] = []
  private offset = new THREE.Vector3(0, BODY_MESH_Y, 0)   // body center relative to eyes
  private emitTimer = 0
  private flickerClock = 0
  private lastPos = new THREE.Vector3()
  private hasLastPos = false
  private perp = new THREE.Vector3(0, 0, 1)   // last valid lateral axis

  // Player color is unused: rift channels are pure R/G/B (the essence of the chromatic glitch).
  constructor(_color: string) {
    this.geometry = new THREE.SphereGeometry(RIFT_RADIUS, 8, 8)
    for (let i = 0; i < RIFT_POOL; i++) {
      const meshes: THREE.Mesh[] = []
      const mats: THREE.MeshBasicMaterial[] = []
      for (const channel of RIFT_CHANNELS) {
        const mat = new THREE.MeshBasicMaterial({
          color: channel, transparent: true, opacity: 0, depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const mesh = new THREE.Mesh(this.geometry, mat)
        mesh.visible = false
        mesh.userData.noRaycast = true
        this.object3d.add(mesh)
        meshes.push(mesh)
        mats.push(mat)
      }
      this.triplets.push({ meshes, mats, life: 0 })
    }
  }

  update(dt: number, ctx: DashTrailContext) {
    const ms = dt * 1000
    this.flickerClock += ms
    if (ctx.dashing) {
      // Lateral axis is perpendicular to motion (degenerate delta -> keep previous axis).
      if (this.hasLastPos) {
        const delta = ctx.position.clone().sub(this.lastPos)
        if (delta.lengthSq() > 1e-8) {
          const p = delta.cross(UP)
          if (p.lengthSq() > 1e-8) this.perp.copy(p.normalize())
        }
      }
      this.emitTimer -= ms
      if (this.emitTimer <= 0) {
        this.emitTimer = RIFT_INTERVAL_MS
        this.emit(ctx.position)
      }
    } else {
      this.emitTimer = 0
      this.hasLastPos = false
    }
    this.lastPos.copy(ctx.position)
    if (ctx.dashing) this.hasLastPos = true

    const dim = Math.floor(this.flickerClock / FLICKER_INTERVAL_MS) % 2 === 1 ? FLICKER_DIM : 1
    for (const tr of this.triplets) {
      if (tr.life <= 0) continue
      tr.life -= ms
      if (tr.life <= 0) {
        tr.meshes.forEach(m => { m.visible = false })
        tr.mats.forEach(m => { m.opacity = 0 })
        continue
      }
      const t = tr.life / RIFT_LIFE_MS   // 1 -> 0
      tr.mats.forEach(m => { m.opacity = RIFT_OPACITY * t * dim })
    }
  }

  private emit(eyePos: THREE.Vector3) {
    const tr = this.triplets.find(x => x.life <= 0)
    if (!tr) return   // pool exhausted -- skip (minor visual detail)
    const center = eyePos.clone().add(this.offset)
    const shifts = [1, 0, -1]   // R / G / B along the lateral axis
    tr.meshes.forEach((mesh, i) => {
      mesh.position.copy(center).addScaledVector(this.perp, shifts[i] * RIFT_OFFSET)
      mesh.visible = true
    })
    tr.mats.forEach(m => { m.opacity = RIFT_OPACITY })
    tr.life = RIFT_LIFE_MS
  }

  get aliveCount() { return this.triplets.reduce((n, t) => n + (t.life > 0 ? 1 : 0), 0) }

  dispose() {
    this.geometry.dispose()
    this.triplets.forEach(t => t.mats.forEach(m => m.dispose()))
  }
}
