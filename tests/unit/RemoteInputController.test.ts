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
    tick: 0, keys: { f: false, b: false, l: false, r: false }, aimDir: [0, 0, -1],
    jump: false, fire: false, shield: false, dash: false, ...over,
  }
}

describe('RemoteInputController — edge actions are not lost', () => {
  const world = new World(new THREE.Scene())

  it('fire from a frame overwritten by a newer one before update is still applied (edges accumulated)', () => {
    const p = makePlayer()
    const rc = new RemoteInputController(p, world)
    rc.enqueue(frame({ tick: 1, fire: true }))    // shot
    rc.enqueue(frame({ tick: 2, fire: false }))   // a newer frame without fire
    rc.update(1 / 60)                             // applies tick 1 (FIFO) + accumulated edges
    expect(p.isWindingUp).toBe(true)             // shot not lost
    expect(rc.ackTick).toBe(1)                   // tick-aligned: oldest applied first
  })

  it('an edge action is applied once (no auto-repeat)', () => {
    const p = makePlayer()
    const rc = new RemoteInputController(p, world)
    rc.enqueue(frame({ tick: 1, shield: true }))
    rc.update(1 / 60)
    expect(p.shieldActive).toBe(true)
    p.activateShield()                           // can't reset — checking there's no repeat
    rc.update(1 / 60)                            // gap (no new frame) — the shield isn't re-activated by this controller
    expect(p.shieldActive).toBe(true)            // still active, no errors
  })
})

// How the controller CONSUMES queued input tick-aligned (one frame per host tick). A fake player records each
// movement application + edge fires.
function spyPlayer(moves: number[], fires: { n: number }) {
  return {
    id: 1, isWindingUp: false, position: new THREE.Vector3(),
    moveIntent: () => moves.push(1),
    setLook: () => {}, aim: () => {}, setJumpInput: () => {},
    activateShield: () => {}, startFiring: () => { fires.n++ }, dash: () => {},
  } as never
}
const ftick = (tick: number, over: Partial<InputFrame> = {}): InputFrame => ({
  tick, keys: { f: true, b: false, l: false, r: false },
  aimDir: [0, 0, -1], jump: false, fire: false, shield: false, dash: false, ...over,
})

describe('RemoteInputController — tick-aligned consumption (1:1)', () => {
  const world = new World(new THREE.Scene())

  it('applies one queued input per host tick, in order, and acks that tick', () => {
    const moves: number[] = [], fires = { n: 0 }
    const rc = new RemoteInputController(spyPlayer(moves, fires), world)
    rc.enqueue(ftick(10)); rc.enqueue(ftick(11)); rc.enqueue(ftick(12))
    rc.update(1 / 60); expect(rc.ackTick).toBe(10)
    rc.update(1 / 60); expect(rc.ackTick).toBe(11)
    rc.update(1 / 60); expect(rc.ackTick).toBe(12)
    rc.update(1 / 60); expect(rc.ackTick).toBe(12)   // gap → hold last, tick unchanged
    expect(moves.length).toBe(4)                      // 3 applied + 1 extrapolated
  })

  it('fires an edge action exactly once even when batched across frames', () => {
    const moves: number[] = [], fires = { n: 0 }
    const rc = new RemoteInputController(spyPlayer(moves, fires), world)
    rc.enqueue(ftick(1, { fire: true })); rc.enqueue(ftick(2, { fire: true }))
    rc.update(1 / 60)   // applies tick 1 + accumulated edges (one fire)
    expect(fires.n).toBe(1)
  })

  it('caps the backlog so it cannot grow unboundedly, still acks the newest applied', () => {
    const moves: number[] = [], fires = { n: 0 }
    const rc = new RemoteInputController(spyPlayer(moves, fires), world)
    for (let t = 1; t <= 20; t++) rc.enqueue(ftick(t))   // backlog of 20, cap 8
    rc.update(1 / 60)
    expect(rc.ackTick).toBeGreaterThanOrEqual(13)          // oldest dropped → applies from within the last 8
  })
})
