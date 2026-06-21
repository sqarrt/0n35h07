import * as THREE from 'three'
import type { Player } from '../game/Player'
import type { World } from '../game/World'
import { horizontalBasis, moveVelocity, dashDirection } from '../game/controllers/movement'
import type { InputFrame } from './protocol'
import { AIM_RANGE } from '../constants'

// Module-level scratch vectors — safe (JS is single-threaded).
const _look     = new THREE.Vector3()
const _basis    = { dir: new THREE.Vector3(), right: new THREE.Vector3() }
const _vel      = new THREE.Vector3()
const _aimDir   = new THREE.Vector3()
const _origin   = new THREE.Vector3()
const _fallback = new THREE.Vector3()

/**
 * Applies a networked input frame to Player via the same intent methods a human uses
 * (DRY with HumanController via movement.ts). The aim is resolved by a ray from the player's
 * eyes along aimDir IN THE HOST'S WORLD — hits are computed by the authority, not trusting the client.
 */
export function intentsFromInput(player: Player, frame: InputFrame, dt: number, world: World) {
  const look = _look.set(frame.aimDir[0], frame.aimDir[1], frame.aimDir[2])
  const { dir, right } = horizontalBasis(look, _basis)
  const keys = { forward: frame.keys.f, back: frame.keys.b, left: frame.keys.l, right: frame.keys.r }

  player.moveIntent(moveVelocity(keys, dir, right, player.isWindingUp, _vel), dt)
  player.setLook(look)   // model orientation follows the client's look (like a local human)

  // Aim: a ray from the client's origin (camera: in TP offset behind the back) along the full aimDir, excluding own body.
  // Origin comes from the frame so the host's authoritative ray matches what the client saw (otherwise a miss in third person).
  const aimDir = look.lengthSq() === 0 ? _aimDir.set(0, 0, -1) : _aimDir.copy(look).normalize()
  const origin = frame.aimOrigin
    ? _origin.set(frame.aimOrigin[0], frame.aimOrigin[1], frame.aimOrigin[2])
    : player.position
  const hit = world.raycast(origin, aimDir, [player.id])
  const aimPoint = hit ? hit.point : _fallback.copy(origin).addScaledVector(aimDir, AIM_RANGE)
  player.aim(aimPoint)

  player.setJumpInput(frame.jump)   // held state (auto-bhop/double jump is computed by Body on the host)
  if (frame.shield) player.activateShield()
  if (frame.fire)   player.startFiring()
  if (frame.dash) {
    const d = dashDirection(keys, aimDir, right)   // aimDir — full look (with pitch); right — horizontal
    if (d) player.dash(d)
  }
}
