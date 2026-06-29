import { describe, it, expect } from 'vitest'
import { LagCompHistory } from '../../src/game/LagCompHistory'

const out = () => ({ x: 0, y: 0, z: 0 })

describe('LagCompHistory', () => {
  it('interpolates a position between recorded ticks', () => {
    const h = new LagCompHistory()
    h.record(10, 0, 0, 0); h.record(12, 4, 0, 0)
    const o = out(); expect(h.at(11, o)).toBe(true); expect(o.x).toBeCloseTo(2, 5)
  })
  it('clamps to the ends and is false when empty', () => {
    const h = new LagCompHistory()
    expect(h.at(5, out())).toBe(false)
    h.record(10, 1, 0, 0); const o = out()
    h.at(0, o); expect(o.x).toBe(1); h.at(99, o); expect(o.x).toBe(1)
  })
  it('drops ticks beyond the window', () => {
    const h = new LagCompHistory(3)
    for (let t = 0; t < 8; t++) h.record(t, t, 0, 0)
    const o = out(); h.at(0, o); expect(o.x).toBeGreaterThanOrEqual(5)   // only last 3 kept
  })
})
