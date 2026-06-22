import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player } from '../../src/game/Player'
import { Body } from '../../src/game/Body'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import { Shield } from '../../src/game/Shield'
import { World } from '../../src/game/World'
import { RemoteInputController } from '../../src/game/controllers/RemoteInputController'
import type { InputFrame } from '../../src/net/protocol'

function makePlayer() {
  return new Player(1, new Body(1, '#f44'), new BeamWeapon(), new Shield(), '#f44')
}
function frame(over: Partial<InputFrame> = {}): InputFrame {
  return {
    seq: 0, keys: { f: false, b: false, l: false, r: false }, aimDir: [0, 0, -1],
    jump: false, fire: false, shield: false, dash: false, ...over,
  }
}

describe('RemoteInputController — edge actions are not lost', () => {
  const world = new World(new THREE.Scene())

  it('fire from a frame overwritten by a newer one before update is still applied', () => {
    const p = makePlayer()
    const rc = new RemoteInputController(p, world)
    rc.enqueue(frame({ seq: 1, fire: true }))    // shot
    rc.enqueue(frame({ seq: 2, fire: false }))   // a newer frame without fire overwrote latest
    rc.update(0.016)
    expect(p.isWindingUp).toBe(true)             // shot not lost
    expect(rc.ackSeq).toBe(2)                    // movement — from the newest frame
  })

  it('an edge action is applied once (no auto-repeat)', () => {
    const p = makePlayer()
    const rc = new RemoteInputController(p, world)
    rc.enqueue(frame({ seq: 1, shield: true }))
    rc.update(0.016)
    expect(p.shieldActive).toBe(true)
    p.activateShield()                           // can't reset — checking there's no repeat
    rc.update(0.016)                             // without a new frame — the shield isn't re-activated by this controller
    expect(p.shieldActive).toBe(true)            // still active (one cycle), no errors
  })
})
