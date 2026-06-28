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

// How the controller CONSUMES queued input (movement per frame, edges once) — a fake player records each
// moveIntent's dt, so we can assert no movement is dropped when frames arrive batched.
function spyPlayer(moveDts: number[], fires: { n: number }) {
  return {
    id: 1, isWindingUp: false, position: new THREE.Vector3(),
    moveIntent: (_v: unknown, dt: number) => moveDts.push(dt),
    setLook: () => {}, aim: () => {}, setJumpInput: () => {},
    activateShield: () => {}, startFiring: () => { fires.n++ }, dash: () => {},
  } as never
}
const fdt = (seq: number, dt: number | undefined, over: Partial<InputFrame> = {}): InputFrame => ({
  seq, dt, keys: { f: true, b: false, l: false, r: false },
  aimDir: [0, 0, -1], jump: false, fire: false, shield: false, dash: false, ...over,
})

describe('RemoteInputController — movement replay (no loss to network batching)', () => {
  const world = new World(new THREE.Scene())

  it('replays EVERY queued frame with its own dt (a burst is not collapsed to the newest)', () => {
    const moveDts: number[] = [], fires = { n: 0 }
    const rc = new RemoteInputController(spyPlayer(moveDts, fires), world)
    rc.enqueue(fdt(1, 0.016)); rc.enqueue(fdt(2, 0.018)); rc.enqueue(fdt(3, 0.015))
    rc.update(0.016)
    expect(moveDts).toEqual([0.016, 0.018, 0.015])
    expect(rc.ackSeq).toBe(3)
  })

  it('a missing/garbage frame dt falls back to 1/60', () => {
    const moveDts: number[] = [], fires = { n: 0 }
    const rc = new RemoteInputController(spyPlayer(moveDts, fires), world)
    rc.enqueue(fdt(1, undefined)); rc.enqueue(fdt(2, 5 /* spike */))
    rc.update(0.016)
    expect(moveDts).toEqual([1 / 60, 1 / 60])
  })

  it('extrapolates on a network gap (re-applies the last movement, no new edge action)', () => {
    const moveDts: number[] = [], fires = { n: 0 }
    const rc = new RemoteInputController(spyPlayer(moveDts, fires), world)
    rc.enqueue(fdt(1, 0.016, { fire: true })); rc.update(0.016)   // 1 move, 1 fire
    rc.update(0.016)                                              // gap → extrapolate, no fire
    expect(moveDts.length).toBe(2)
    expect(fires.n).toBe(1)
  })

  it('caps catch-up so a backlog cannot fling the avatar, but still acks the newest seq', () => {
    const moveDts: number[] = [], fires = { n: 0 }
    const rc = new RemoteInputController(spyPlayer(moveDts, fires), world)
    for (let s = 1; s <= 20; s++) rc.enqueue(fdt(s, 0.016))
    rc.update(0.016)
    expect(moveDts.length).toBeLessThanOrEqual(8)
    expect(rc.ackSeq).toBe(20)
  })
})
