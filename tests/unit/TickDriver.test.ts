import { describe, it, expect } from 'vitest'
import { TickDriver } from '../../src/game/TickDriver'
import { FIXED_DT, MAX_CATCHUP_STEPS } from '../../src/constants'

describe('TickDriver', () => {
  it('one exact tick of real time → one tick, alpha 0', () => {
    const d = new TickDriver()
    expect(d.advance(FIXED_DT)).toEqual({ ticks: 1, alpha: 0 })
  })
  it('half a tick → zero ticks, alpha 0.5 (accumulates)', () => {
    const d = new TickDriver()
    const r = d.advance(FIXED_DT / 2)
    expect(r.ticks).toBe(0)
    expect(r.alpha).toBeCloseTo(0.5, 5)
  })
  it('accumulates across frames — two half-ticks make one tick', () => {
    const d = new TickDriver()
    d.advance(FIXED_DT / 2)
    expect(d.advance(FIXED_DT / 2)).toEqual({ ticks: 1, alpha: 0 })
  })
  it('2.5 ticks of real time → 2 ticks, alpha 0.5', () => {
    const d = new TickDriver()
    const r = d.advance(FIXED_DT * 2.5)
    expect(r.ticks).toBe(2)
    expect(r.alpha).toBeCloseTo(0.5, 5)
  })
  it('a long stall is capped at MAX_CATCHUP_STEPS and sheds the overflow (no spiral)', () => {
    const d = new TickDriver()
    const r = d.advance(100) // huge spike
    expect(r.ticks).toBe(MAX_CATCHUP_STEPS)
    expect(r.alpha).toBeGreaterThanOrEqual(0)
    expect(r.alpha).toBeLessThan(1)
    // next frame doesn't replay the shed backlog
    expect(d.advance(FIXED_DT).ticks).toBe(1)
  })
  it('alpha getter reflects the last drained remainder', () => {
    const d = new TickDriver()
    d.advance(FIXED_DT * 1.25)
    expect(d.alpha).toBeCloseTo(0.25, 5)
  })
  it('a positive driftSec nudge brings a tick earlier (clock-sync speed-up)', () => {
    const d = new TickDriver()
    // just under a tick of real time, but the nudge tops it over → a tick this frame
    const r = d.advance(FIXED_DT * 0.9, FIXED_DT * 0.2)
    expect(r.ticks).toBe(1)
  })
  it('a negative driftSec nudge holds a tick back, and never drives the accumulator negative', () => {
    const d = new TickDriver()
    const r = d.advance(FIXED_DT, -FIXED_DT * 0.3)   // a full tick minus a slow-down nudge → no tick yet
    expect(r.ticks).toBe(0)
    // a large negative nudge can't bank negative time (which would later swallow a real tick)
    d.advance(0, -FIXED_DT * 5)
    expect(d.advance(FIXED_DT).ticks).toBe(1)
  })
})
