import * as THREE from 'three'
import type { IDashTrail, DashTrailContext } from '../abstractions'
import { SpritePool } from './SpritePool'
import {
  BODY_MESH_Y,
  DASH_TRAIL_GHOST_COUNT, DASH_TRAIL_GHOST_RADIUS,
  DASH_TRAIL_GHOST_INTERVAL, DASH_TRAIL_GHOST_LIFE, DASH_TRAIL_GHOST_OPACITY,
} from '../../constants'

/** A. Speed clones: semi-transparent spheres along the dash path, fading out in ~0.26s. */
export class AfterimageTrail implements IDashTrail {
  readonly object3d: THREE.Object3D
  private pool: SpritePool
  private offset = new THREE.Vector3(0, BODY_MESH_Y, 0)   // body-sphere center relative to the eyes
  private emitTimer = 0

  constructor(color: THREE.Color) {
    this.pool = new SpritePool(color, DASH_TRAIL_GHOST_COUNT, DASH_TRAIL_GHOST_RADIUS)
    this.object3d = this.pool.object3d
  }

  update(dt: number, ctx: DashTrailContext) {
    if (ctx.dashing) {
      this.emitTimer -= dt * 1000
      if (this.emitTimer <= 0) {
        this.emitTimer = DASH_TRAIL_GHOST_INTERVAL
        this.pool.emit({
          position: ctx.position.clone().add(this.offset),
          life: DASH_TRAIL_GHOST_LIFE,
          opacity: DASH_TRAIL_GHOST_OPACITY,
        })
      }
    } else {
      this.emitTimer = 0
    }
    this.pool.update(dt)
  }

  get aliveCount() { return this.pool.aliveCount }
  dispose() { this.pool.dispose() }
}
