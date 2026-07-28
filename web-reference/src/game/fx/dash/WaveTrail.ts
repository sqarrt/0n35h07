import * as THREE from 'three'
import type { IDashTrail, DashTrailContext } from '../../abstractions'
import { BODY_MESH_Y } from '../../../constants'

// WAVE: dash leaves shockwave rings along the path (plane across motion),
// rings expand and fade out. Purely cosmetic, player color.
const WAVE_INTERVAL_MS = 25    // ms between rings (dense wave palisade)
const WAVE_LIFE_MS     = 450   // ring lifetime, ms
const WAVE_POOL        = 20    // pool size
const WAVE_INNER       = 0.3   // initial inner ring radius
const WAVE_OUTER       = 0.38  // initial outer ring radius
const WAVE_SEGMENTS    = 24
const WAVE_GROW        = 3.5   // units/s -- scale growth rate
const WAVE_OPACITY     = 0.7   // initial opacity

const RING_NORMAL = new THREE.Vector3(0, 0, 1)   // default RingGeometry normal

interface Wave {
  mesh:    THREE.Mesh
  mat:     THREE.MeshBasicMaterial
  life:    number   // remaining life, ms
}

export class WaveTrail implements IDashTrail {
  readonly object3d = new THREE.Group()
  private geometry: THREE.RingGeometry
  private waves: Wave[] = []
  private offset = new THREE.Vector3(0, BODY_MESH_Y, 0)   // body center relative to eyes
  private emitTimer = 0
  private lastPos = new THREE.Vector3()
  private hasLastPos = false
  private dir = new THREE.Vector3(1, 0, 0)   // last valid movement direction

  constructor(color: string) {
    this.geometry = new THREE.RingGeometry(WAVE_INNER, WAVE_OUTER, WAVE_SEGMENTS)
    for (let i = 0; i < WAVE_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(this.geometry, mat)
      mesh.visible = false
      mesh.userData.noRaycast = true
      this.object3d.add(mesh)
      this.waves.push({ mesh, mat, life: 0 })
    }
  }

  update(dt: number, ctx: DashTrailContext) {
    const ms = dt * 1000
    if (ctx.dashing) {
      // Direction from position delta (degenerate delta -> keep previous direction).
      if (this.hasLastPos) {
        const delta = ctx.position.clone().sub(this.lastPos)
        if (delta.lengthSq() > 1e-8) this.dir.copy(delta.normalize())
      }
      this.emitTimer -= ms
      if (this.emitTimer <= 0) {
        this.emitTimer = WAVE_INTERVAL_MS
        this.emit(ctx.position)
      }
    } else {
      this.emitTimer = 0
      this.hasLastPos = false
    }
    this.lastPos.copy(ctx.position)
    if (ctx.dashing) this.hasLastPos = true

    for (const w of this.waves) {
      if (w.life <= 0) continue
      w.life -= ms
      if (w.life <= 0) { w.mesh.visible = false; w.mat.opacity = 0; continue }
      const t = w.life / WAVE_LIFE_MS                    // 1 -> 0
      const age = (WAVE_LIFE_MS - w.life) / 1000         // seconds since emit
      w.mat.opacity = WAVE_OPACITY * t
      w.mesh.scale.setScalar(1 + WAVE_GROW * age)
    }
  }

  private emit(eyePos: THREE.Vector3) {
    const w = this.waves.find(x => x.life <= 0)
    if (!w) return   // pool exhausted -- skip (minor visual detail)
    w.mesh.position.copy(eyePos).add(this.offset)
    w.mesh.quaternion.setFromUnitVectors(RING_NORMAL, this.dir)   // ring plane across motion
    w.mesh.scale.setScalar(1)
    w.mesh.visible = true
    w.mat.opacity = WAVE_OPACITY
    w.life = WAVE_LIFE_MS
  }

  get aliveCount() { return this.waves.reduce((n, w) => n + (w.life > 0 ? 1 : 0), 0) }

  dispose() {
    this.geometry.dispose()
    this.waves.forEach(w => w.mat.dispose())
  }
}
