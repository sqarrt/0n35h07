import * as THREE from 'three'
import { MOVE_SPEED, WINDUP_MOVE_FACTOR } from '../../constants'

/** Состояние клавиш движения — общая форма для человека и сетевого ввода. */
export interface MoveKeys { forward: boolean; back: boolean; left: boolean; right: boolean }

const UP = new THREE.Vector3(0, 1, 0)

/** Горизонтальный базис (forward/right) из направления взгляда. */
export function horizontalBasis(look: THREE.Vector3): { dir: THREE.Vector3; right: THREE.Vector3 } {
  const dir = look.clone()
  dir.y = 0
  if (dir.lengthSq() === 0) dir.set(0, 0, -1)
  dir.normalize()
  const right = new THREE.Vector3().crossVectors(dir, UP).normalize()
  return { dir, right }
}

/** Желаемая скорость WASD: единичное направление × MOVE_SPEED (диагональ НЕ быстрее — нормализуем, чтобы
 *  wishspeed был чётко определён для скоростной модели). Замедление во время заряда выстрела. */
export function moveVelocity(
  keys: MoveKeys, dir: THREE.Vector3, right: THREE.Vector3, windingUp: boolean,
): THREE.Vector3 {
  const vel = new THREE.Vector3()
  if (keys.forward) vel.add(dir)
  if (keys.back)    vel.sub(dir)
  if (keys.left)    vel.sub(right)
  if (keys.right)   vel.add(right)
  if (vel.lengthSq() > 0) vel.normalize().multiplyScalar(MOVE_SPEED)
  if (windingUp) vel.multiplyScalar(WINDUP_MOVE_FACTOR)
  return vel
}

/** Направление рывка из WASD (null — нет нажатых клавиш движения). */
export function dashDirection(keys: MoveKeys, dir: THREE.Vector3, right: THREE.Vector3): THREE.Vector3 | null {
  const d = new THREE.Vector3()
  if (keys.forward) d.add(dir)
  if (keys.back)    d.sub(dir)
  if (keys.right)   d.add(right)
  if (keys.left)    d.sub(right)
  return d.lengthSq() === 0 ? null : d.normalize()
}
