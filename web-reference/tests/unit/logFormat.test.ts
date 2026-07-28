import { describe, it, expect } from 'vitest'
import { fmtFields, formatLine, sessionFileName } from '../../src/diag/logFormat'

describe('logFormat', () => {
  it('formats scalar/array/string fields greppably', () => {
    expect(fmtFields({ id: 1, hit: 0, point: [1.25, 1.7, 0], name: 'a b' }))
      .toBe('id=1 hit=0 point=[1.25,1.7,0] name="a b"')
  })
  it('omits the trailing space when there are no fields', () => {
    expect(formatLine('2026-06-30T00:00:01.000Z', 1234, 'info', 'act', 'fire'))
      .toBe('2026-06-30T00:00:01.000Z +1234 I act fire')
  })
  it('renders level as a single char and appends fields', () => {
    expect(formatLine('2026-06-30T00:00:01.000Z', 12, 'warn', 'nego', 'duration_fallback', { want: 5, got: 3 }))
      .toBe('2026-06-30T00:00:01.000Z +12 W nego duration_fallback want=5 got=3')
  })
  it('builds a sortable session filename from a Date', () => {
    expect(sessionFileName(new Date('2026-06-30T01:22:03.000Z'))).toMatch(/^oneshot-20260630-\d{6}\.log$/)
  })
})
