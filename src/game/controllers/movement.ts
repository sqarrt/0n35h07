import * as THREE from 'three'
import { MOVE_SPEED, WINDUP_MOVE_FACTOR } from '../../constants'

/** Movement key state — shared shape for human and network input. */
export interface MoveKeys { forward: boolean; back: boolean; left: boolean; right: boolean }

const UP = new THREE.Vector3(0, 1, 0)

/** Horizontal basis (forward/right) from the look direction.
 *  out — reusable scratch (no allocations); if not passed, creates new vectors. */
export function horizontalBasis(
  look: THREE.Vector3,
  out?: { dir: THREE.Vector3; right: THREE.Vector3 },
): { dir: THREE.Vector3; right: THREE.Vector3 } {
  const o = out ?? { dir: new THREE.Vector3(), right: new THREE.Vector3() }
  o.dir.copy(look)
  o.dir.y = 0
  if (o.dir.lengthSq() === 0) o.dir.set(0, 0, -1)
  o.dir.normalize()
  o.right.crossVectors(o.dir, UP).normalize()
  return o
}

/** Desired WASD velocity: unit direction × MOVE_SPEED (diagonals are NOT faster — we normalize so
 *  wishspeed is well-defined for the speed model). Slowed down while charging a shot.
 *  out — reusable scratch (no allocations); if not passed, creates a new vector. */
export function moveVelocity(
  keys: MoveKeys, dir: THREE.Vector3, right: THREE.Vector3, windingUp: boolean,
  out?: THREE.Vector3,
): THREE.Vector3 {
  const vel = out ?? new THREE.Vector3()
  vel.set(0, 0, 0)
  if (keys.forward) vel.add(dir)
  if (keys.back)    vel.sub(dir)
  if (keys.left)    vel.sub(right)
  if (keys.right)   vel.add(right)
  if (vel.lengthSq() > 0) vel.normalize().multiplyScalar(MOVE_SPEED)
  if (windingUp) vel.multiplyScalar(WINDUP_MOVE_FACTOR)
  return vel
}

/**
 * Dash direction from WASD with camera awareness: forward/back follow the FULL `look` (with pitch,
 * so the dash goes up/down when you look up/down), strafe (A/D) is strictly horizontal along `right`.
 * `look` is expected to be a unit 3D look vector. null — no movement keys pressed (we don't dash "into the void").
 */
export function dashDirection(keys: MoveKeys, look: THREE.Vector3, right: THREE.Vector3): THREE.Vector3 | null {
  const d = new THREE.Vector3()
  if (keys.forward) d.add(look)
  if (keys.back)    d.sub(look)
  if (keys.right)   d.add(right)
  if (keys.left)    d.sub(right)
  return d.lengthSq() === 0 ? null : d.normalize()
}
