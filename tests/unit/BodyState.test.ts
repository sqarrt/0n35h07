import { describe, it, expect } from 'vitest'
import { Body } from '../../src/game/Body'

describe('Body save/restore (prediction replay)', () => {
  it('round-trips the movement state', () => {
    const b = new Body(1, '#f44')
    b.position.set(3, 2, 1); b.velocityY = -4; b.grounded = false
    const s = b.saveState()
    b.position.set(0, 0, 0); b.velocityY = 0; b.grounded = true   // mutate away
    b.restoreState(s)
    expect(b.position.toArray()).toEqual([3, 2, 1])
    expect(b.velocityY).toBe(-4)
    expect(b.grounded).toBe(false)
  })
  it('saveState is a value snapshot — later mutation does not change it', () => {
    const b = new Body(1, '#f44')
    b.velocityY = 5
    const s = b.saveState()
    b.velocityY = 99
    expect(s.vy).toBe(5)
  })
})
