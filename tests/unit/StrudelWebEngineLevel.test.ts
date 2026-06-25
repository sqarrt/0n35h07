import { describe, it, expect } from 'vitest'
import { StrudelWebEngine } from '../../src/radio/music/StrudelWebEngine'

describe('StrudelWebEngine level metering', () => {
  it('readLevel() returns 0 before init (no AudioContext)', () => {
    const e = new StrudelWebEngine()
    expect(e.readLevel()).toBe(0)
  })
  it('readBands() is a no-op before init (max-combine accumulator left unchanged)', () => {
    const e = new StrudelWebEngine()
    const out = new Float32Array(8).fill(0.5)
    e.readBands(out)
    expect(Array.from(out)).toEqual(new Array(8).fill(0.5))
  })
})
