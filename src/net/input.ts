import * as THREE from 'three'
import type { Player } from '../game/Player'
import type { World } from '../game/World'
import { horizontalBasis, moveVelocity, dashDirection } from '../game/controllers/movement'
import type { InputFrame } from './protocol'
import { AIM_RANGE } from '../constants'

// Модульные scratch-векторы — безопасно (JS однопоточен).
const _look     = new THREE.Vector3()
const _basis    = { dir: new THREE.Vector3(), right: new THREE.Vector3() }
const _vel      = new THREE.Vector3()
const _aimDir   = new THREE.Vector3()
const _fallback = new THREE.Vector3()

/**
 * Применяет сетевой кадр ввода к Player через те же intent-методы, что и человек
 * (DRY с HumanController через movement.ts). Прицел резолвится лучом из глаз игрока
 * по aimDir В МИРЕ ХОСТА — попадания считает авторитет, не доверяя клиенту.
 */
export function intentsFromInput(player: Player, frame: InputFrame, dt: number, world: World) {
  const look = _look.set(frame.aimDir[0], frame.aimDir[1], frame.aimDir[2])
  const { dir, right } = horizontalBasis(look, _basis)
  const keys = { forward: frame.keys.f, back: frame.keys.b, left: frame.keys.l, right: frame.keys.r }

  player.moveIntent(moveVelocity(keys, dir, right, player.isWindingUp, _vel), dt)
  player.setLook(look)   // ориентация модели — по взгляду клиента (как у локального человека)

  // Прицел: луч из глаз вдоль полного aimDir (не горизонтального), исключая своё тело.
  const aimDir = look.lengthSq() === 0 ? _aimDir.set(0, 0, -1) : _aimDir.copy(look).normalize()
  const origin = player.position
  const hit = world.raycast(origin, aimDir, [player.id])
  const aimPoint = hit ? hit.point : _fallback.copy(origin).addScaledVector(aimDir, AIM_RANGE)
  player.aim(aimPoint)

  player.setJumpInput(frame.jump)   // held-состояние (auto-bhop/двойной прыжок считает Body на хосте)
  if (frame.shield) player.activateShield()
  if (frame.fire)   player.startFiring()
  if (frame.dash) {
    const d = dashDirection(keys, aimDir, right)   // aimDir — полный взгляд (с наклоном); right — горизонтальный
    if (d) player.dash(d)
  }
}
