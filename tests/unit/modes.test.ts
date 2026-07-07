import { describe, it, expect } from 'vitest'
import { MODE_SLOT_COUNT, teamOfSlot, canStartFor } from '../../src/game/modes'

describe('modes', () => {
  it('slot counts per mode', () => {
    expect(MODE_SLOT_COUNT['1v1']).toBe(2)
    expect(MODE_SLOT_COUNT['2v2']).toBe(4)
    expect(MODE_SLOT_COUNT['ffa']).toBe(4)
  })

  it('1v1/ffa: every slot is its own team', () => {
    expect([0, 1].map(s => teamOfSlot('1v1', s))).toEqual([0, 1])
    expect([0, 1, 2, 3].map(s => teamOfSlot('ffa', s))).toEqual([0, 1, 2, 3])
  })

  it('2v2: slots 0-1 team 0, slots 2-3 team 1', () => {
    expect([0, 1, 2, 3].map(s => teamOfSlot('2v2', s))).toEqual([0, 0, 1, 1])
  })

  it('canStart: 1v1 needs 2, 2v2 needs all 4, ffa needs >=2', () => {
    expect(canStartFor('1v1', 1)).toBe(false)
    expect(canStartFor('1v1', 2)).toBe(true)
    expect(canStartFor('2v2', 3)).toBe(false)
    expect(canStartFor('2v2', 4)).toBe(true)
    expect(canStartFor('ffa', 1)).toBe(false)
    expect(canStartFor('ffa', 2)).toBe(true)
    expect(canStartFor('ffa', 4)).toBe(true)
  })
})
