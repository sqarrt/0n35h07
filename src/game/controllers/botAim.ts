import * as THREE from 'three'
import { BALL_RADIUS } from '../../constants'

export type Rng = () => number

/** Hit/miss roll: true with probability hitChance. */
export function rollHit(hitChance: number, rng: Rng = Math.random): boolean {
  return rng() < hitChance
}

// Scratch for the perpendicular-plane basis (calls are strictly sequential)
const _dir   = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up    = new THREE.Vector3()
const WORLD_UP = new THREE.Vector3(0, 1, 0)

/**
 * Shot aim point.
 * hit=true  → exactly the target's center (base).
 * hit=false → near-miss: base offset in the plane perpendicular to the line of fire
 *   by BALL_RADIUS*(1+grazeMargin) at a random angle. The shooter→out ray passes
 *   just past the hitbox edge — the miss looks like a graze, not an obvious sideways shot.
 *   The smaller grazeMargin (stronger bot), the closer to a hit.
 */
export function aimPoint(
  out: THREE.Vector3,
  base: THREE.Vector3,
  shooter: THREE.Vector3,
  hit: boolean,
  grazeMargin: number,
  rng: Rng = Math.random,
): THREE.Vector3 {
  out.copy(base)
  if (hit) return out

  _dir.copy(base).sub(shooter)
  if (_dir.lengthSq() < 1e-6) return out
  _dir.normalize()

  // Orthonormal basis of the plane perpendicular to the fire direction
  _right.copy(_dir).cross(WORLD_UP)
  if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0)   // aiming straight up/down
  _right.normalize()
  _up.copy(_right).cross(_dir).normalize()

  const theta = rng() * Math.PI * 2
  const mag = BALL_RADIUS * (1 + grazeMargin)
  out.addScaledVector(_right, Math.cos(theta) * mag)
  out.addScaledVector(_up,    Math.sin(theta) * mag)
  return out
}
