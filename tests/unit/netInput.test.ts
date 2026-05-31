import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player } from '../../src/game/Player'
import { Body } from '../../src/game/Body'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import { Shield } from '../../src/game/Shield'
import { World } from '../../src/game/World'
import { horizontalBasis, moveVelocity, dashDirection } from '../../src/game/controllers/movement'
import { intentsFromInput } from '../../src/net/input'
import type { InputFrame } from '../../src/net/protocol'
import { MOVE_SPEED } from '../../src/constants'

const KEYS = { forward: false, back: false, left: false, right: false }

describe('movement helpers', () => {
  it('horizontalBasis: взгляд -Z даёт forward=-Z, right=+X', () => {
    const { dir, right } = horizontalBasis(new THREE.Vector3(0, 0, -1))
    expect(dir.z).toBeCloseTo(-1)
    expect(right.x).toBeCloseTo(1)
  })

  it('moveVelocity: W едет по forward со скоростью MOVE_SPEED', () => {
    const { dir, right } = horizontalBasis(new THREE.Vector3(0, 0, -1))
    const v = moveVelocity({ ...KEYS, forward: true }, dir, right, false)
    expect(v.z).toBeCloseTo(-MOVE_SPEED)
  })

  it('dashDirection: нет WASD → null', () => {
    const { dir, right } = horizontalBasis(new THREE.Vector3(0, 0, -1))
    expect(dashDirection({ ...KEYS }, dir, right)).toBeNull()
  })
})

function makePlayer() {
  return new Player(0, new Body(0, '#4af'), new BeamWeapon(), new Shield(), '#4af')
}
function frame(over: Partial<InputFrame> = {}): InputFrame {
  return {
    seq: 0, keys: { f: false, b: false, l: false, r: false }, aimDir: [0, 0, -1],
    jump: false, fire: false, shield: false, dash: false, ...over,
  }
}

describe('intentsFromInput (хост применяет ввод клиента)', () => {
  const world = new World(new THREE.Scene())

  it('W копит движение вперёд (desired.z < 0)', () => {
    const p = makePlayer()
    intentsFromInput(p, frame({ keys: { f: true, b: false, l: false, r: false } }), 0.016, world)
    expect(p.consumeDesired().z).toBeLessThan(0)
  })

  it('fire запускает заряд', () => {
    const p = makePlayer()
    intentsFromInput(p, frame({ fire: true }), 0.016, world)
    expect(p.isWindingUp).toBe(true)
  })

  it('shield активирует щит', () => {
    const p = makePlayer()
    intentsFromInput(p, frame({ shield: true }), 0.016, world)
    expect(p.shieldActive).toBe(true)
  })

  it('dash при нажатом W стартует рывок', () => {
    const p = makePlayer()
    intentsFromInput(p, frame({ dash: true, keys: { f: true, b: false, l: false, r: false } }), 0.016, world)
    expect(p.dashing).toBe(true)
  })
})
