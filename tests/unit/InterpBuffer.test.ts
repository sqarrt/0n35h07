import { describe, it, expect } from 'vitest'
import { InterpBuffer } from '../../src/net/InterpBuffer'

const out = () => ({ x: 0, y: 0, z: 0 })

describe('InterpBuffer', () => {
  it('interpolates linearly between the two bracketing samples', () => {
    const b = new InterpBuffer()
    b.push(1000, 0, 0, 0); b.push(1100, 10, 0, 0)   // 100ms apart, x 0→10
    const o = out()
    expect(b.sample(1050, o)).toBe(true)
    expect(o.x).toBeCloseTo(5, 5)                     // halfway in time → halfway in space
  })
  it('holds the last sample when renderTime is past the newest (no extrapolation)', () => {
    const b = new InterpBuffer()
    b.push(1000, 0, 0, 0); b.push(1100, 10, 0, 0)
    const o = out()
    b.sample(9999, o)
    expect(o.x).toBeCloseTo(10, 5)
  })
  it('clamps to the first sample when renderTime is before the oldest', () => {
    const b = new InterpBuffer()
    b.push(1000, 3, 0, 0); b.push(1100, 9, 0, 0)
    const o = out()
    b.sample(500, o)
    expect(o.x).toBeCloseTo(3, 5)
  })
  it('returns false on an empty buffer', () => {
    expect(new InterpBuffer().sample(0, out())).toBe(false)
  })
})
