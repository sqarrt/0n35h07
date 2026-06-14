import * as THREE from 'three'
import { MOVE_SPEED, WINDUP_MOVE_FACTOR } from '../../constants'

/** Состояние клавиш движения — общая форма для человека и сетевого ввода. */
export interface MoveKeys { forward: boolean; back: boolean; left: boolean; right: boolean }

const UP = new THREE.Vector3(0, 1, 0)

/** Горизонтальный базис (forward/right) из направления взгляда.
 *  out — переиспользуемый scratch (без аллокаций); если не передан, создаёт новые векторы. */
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

/** Желаемая скорость WASD: единичное направление × MOVE_SPEED (диагональ НЕ быстрее — нормализуем, чтобы
 *  wishspeed был чётко определён для скоростной модели). Замедление во время заряда выстрела.
 *  out — переиспользуемый scratch (без аллокаций); если не передан, создаёт новый вектор. */
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
 * Направление рывка из WASD с учётом камеры: forward/back — по ПОЛНОМУ взгляду `look` (с наклоном,
 * поэтому рывок идёт вверх/вниз когда смотришь вверх/вниз), strafe (A/D) — строго горизонтально по `right`.
 * `look` ожидается единичным 3D-вектором взгляда. null — нет нажатых клавиш движения (рывок «в пустоту» не делаем).
 */
export function dashDirection(keys: MoveKeys, look: THREE.Vector3, right: THREE.Vector3): THREE.Vector3 | null {
  const d = new THREE.Vector3()
  if (keys.forward) d.add(look)
  if (keys.back)    d.sub(look)
  if (keys.right)   d.add(right)
  if (keys.left)    d.sub(right)
  return d.lengthSq() === 0 ? null : d.normalize()
}
