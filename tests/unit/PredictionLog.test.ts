import { describe, it, expect } from 'vitest'
import { PredictionLog } from '../../src/net/clientReconcile'
import type { BodyState } from '../../src/game/Body'
import type { InputFrame } from '../../src/net/protocol'

const st = (x: number): BodyState => ({ pos: [x, 1.7, 0], vy: 0, grounded: true, airJumps: 0, jumpHeld: false, prevJumpHeld: false, dashTimer: 0, dashCooldown: 0, knockTimer: 0, velH: [0, 0, 0] })
const inp = (tick: number): InputFrame => ({ tick, keys: { f: true, b: false, l: false, r: false }, aimDir: [0, 0, -1], jump: false, fire: false, shield: false, dash: false })
const EPS = 0.1

describe('PredictionLog', () => {
  it('trusts when the authority matches the prediction at ackTick', () => {
    const log = new PredictionLog()
    log.record(1, inp(1), st(1)); log.record(2, inp(2), st(2))
    expect(log.decide(2, st(2), EPS)).toEqual({ kind: 'trust' })
  })
  it('trusts (no replay) when divergence is within eps', () => {
    const log = new PredictionLog()
    log.record(5, inp(5), st(5))
    expect(log.decide(5, st(5.05), EPS)).toEqual({ kind: 'trust' })
  })
  it('replays from the authority with the unacked inputs when diverged', () => {
    const log = new PredictionLog()
    log.record(1, inp(1), st(1)); log.record(2, inp(2), st(2)); log.record(3, inp(3), st(3))
    const d = log.decide(1, st(2 /* +1 off */), EPS)
    expect(d.kind).toBe('replay')
    if (d.kind === 'replay') {
      expect(d.from.pos[0]).toBe(2)                          // restore to the authority
      expect(d.inputs.map(i => i.tick)).toEqual([2, 3])      // replay the unacked inputs in order
    }
  })
  it('unknown ackTick → trust (nothing to do)', () => {
    const log = new PredictionLog()
    log.record(5, inp(5), st(5))
    expect(log.decide(3, st(99), EPS)).toEqual({ kind: 'trust' })
  })
  it('prunes acknowledged ticks (decide twice does not re-replay old ticks)', () => {
    const log = new PredictionLog()
    log.record(1, inp(1), st(1)); log.record(2, inp(2), st(2))
    log.decide(2, st(2), EPS)                                // acks 2 → prunes ≤2
    expect(log.decide(1, st(99), EPS)).toEqual({ kind: 'trust' })  // tick 1 gone
  })
})
