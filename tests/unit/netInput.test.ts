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
  it('horizontalBasis: looking at -Z gives forward=-Z, right=+X', () => {
    const { dir, right } = horizontalBasis(new THREE.Vector3(0, 0, -1))
    expect(dir.z).toBeCloseTo(-1)
    expect(right.x).toBeCloseTo(1)
  })

  it('moveVelocity: W moves along forward at MOVE_SPEED', () => {
    const { dir, right } = horizontalBasis(new THREE.Vector3(0, 0, -1))
    const v = moveVelocity({ ...KEYS, forward: true }, dir, right, false)
    expect(v.z).toBeCloseTo(-MOVE_SPEED)
  })

  it('dashDirection: no WASD → null', () => {
    const { dir, right } = horizontalBasis(new THREE.Vector3(0, 0, -1))
    expect(dashDirection({ ...KEYS }, dir, right)).toBeNull()
  })

  it('dashDirection: W while looking up gives an upward dash (accounts for pitch)', () => {
    const look = new THREE.Vector3(0, 1, 0)              // looking straight up
    const { right } = horizontalBasis(look)
    const d = dashDirection({ ...KEYS, forward: true }, look, right)!
    expect(d.y).toBeCloseTo(1)
  })

  it('dashDirection: strafe (D) stays horizontal even when looking up', () => {
    const look = new THREE.Vector3(0, 0.7, -0.7).normalize()   // looking up-forward
    const { right } = horizontalBasis(look)
    const d = dashDirection({ ...KEYS, right: true }, look, right)!
    expect(d.y).toBeCloseTo(0)
  })

  it('dashDirection: W+looking up-forward gives a rising diagonal (y>0, z<0)', () => {
    const look = new THREE.Vector3(0, 0.7, -0.7).normalize()
    const { right } = horizontalBasis(look)
    const d = dashDirection({ ...KEYS, forward: true }, look, right)!
    expect(d.y).toBeGreaterThan(0)
    expect(d.z).toBeLessThan(0)
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

describe('intentsFromInput (host applies client input)', () => {
  const world = new World(new THREE.Scene())

  it('W accumulates forward movement (desired.z < 0)', () => {
    const p = makePlayer()
    intentsFromInput(p, frame({ keys: { f: true, b: false, l: false, r: false } }), 0.016, world)
    p.stepHorizontal(0.016, null)   // velocity model: ramp up to the desired speed → desired
    expect(p.consumeDesired().z).toBeLessThan(0)
  })

  it('fire starts the charge-up', () => {
    const p = makePlayer()
    intentsFromInput(p, frame({ fire: true }), 0.016, world)
    expect(p.isWindingUp).toBe(true)
  })

  it('shield activates the shield', () => {
    const p = makePlayer()
    intentsFromInput(p, frame({ shield: true }), 0.016, world)
    expect(p.shieldActive).toBe(true)
  })

  it('dash with W held starts a dash', () => {
    const p = makePlayer()
    intentsFromInput(p, frame({ dash: true, keys: { f: true, b: false, l: false, r: false } }), 0.016, world)
    expect(p.dashing).toBe(true)
  })
})
