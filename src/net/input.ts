import * as THREE from 'three'
import type { Player } from '../game/Player'
import type { World } from '../game/World'
import { horizontalBasis, moveVelocity, dashDirection } from '../game/controllers/movement'
import { fromVec3 } from './protocol'
import type { InputFrame } from './protocol'
import { AIM_RANGE } from '../constants'

/**
 * Применяет сетевой кадр ввода к Player через те же intent-методы, что и человек
 * (DRY с HumanController через movement.ts). Прицел резолвится лучом из глаз игрока
 * по aimDir В МИРЕ ХОСТА — попадания считает авторитет, не доверяя клиенту.
 */
export function intentsFromInput(player: Player, frame: InputFrame, dt: number, world: World) {
  const look = fromVec3(frame.aimDir)
  const { dir, right } = horizontalBasis(look)
  const keys = { forward: frame.keys.f, back: frame.keys.b, left: frame.keys.l, right: frame.keys.r }

  player.moveIntent(moveVelocity(keys, dir, right, player.isWindingUp), dt)
  player.setLook(look)   // ориентация модели — по взгляду клиента (как у локального человека)

  // Прицел: луч из глаз вдоль полного aimDir (не горизонтального), исключая своё тело.
  const aimDir = look.lengthSq() === 0 ? new THREE.Vector3(0, 0, -1) : look.clone().normalize()
  const origin = player.position
  const hit = world.raycast(origin, aimDir, [player.id])
  const aimPoint = hit ? hit.point : origin.clone().addScaledVector(aimDir, AIM_RANGE)
  player.aim(aimPoint)

  player.setJumpInput(frame.jump)   // held-состояние (auto-bhop/двойной прыжок считает Body на хосте)
  if (frame.shield) player.activateShield()
  if (frame.fire)   player.startFiring()
  if (frame.dash) {
    const d = dashDirection(keys, dir, right)
    if (d) player.dash(d)
  }
}
