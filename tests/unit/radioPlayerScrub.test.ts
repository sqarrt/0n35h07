import { describe, it, expect } from 'vitest'
import { fractionFromPointer, fmtMs } from '../../src/components/RadioPlayer'

describe('fractionFromPointer', () => {
  const rect = { left: 100, width: 200 }
  it('maps pointer X to a 0..1 fraction within the rail', () => {
    expect(fractionFromPointer(100, rect)).toBe(0)
    expect(fractionFromPointer(200, rect)).toBe(0.5)
    expect(fractionFromPointer(300, rect)).toBe(1)
  })
  it('clamps outside the rail and guards a zero-width rail', () => {
    expect(fractionFromPointer(50, rect)).toBe(0)
    expect(fractionFromPointer(400, rect)).toBe(1)
    expect(fractionFromPointer(150, { left: 100, width: 0 })).toBe(0)
  })
})

describe('fmtMs', () => {
  it('formats m:ss with a zero-padded seconds field', () => {
    expect(fmtMs(0)).toBe('0:00')
    expect(fmtMs(5000)).toBe('0:05')
    expect(fmtMs(65000)).toBe('1:05')
    expect(fmtMs(600000)).toBe('10:00')
  })
  it('treats negative / NaN as 0:00', () => {
    expect(fmtMs(-1)).toBe('0:00')
    expect(fmtMs(NaN)).toBe('0:00')
  })
})
