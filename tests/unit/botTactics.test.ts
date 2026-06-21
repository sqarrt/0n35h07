import { describe, it, expect } from 'vitest'
import { shouldEvade } from '../../src/game/controllers/botTactics'

const BASE = { kills: 1, oppKills: 0, oppWindingUp: false, hasLOS: true, dist: 100, evadeNear: 6 }

describe('shouldEvade', () => {
  it('не ведёт по очкам → никогда не уклоняется', () => {
    expect(shouldEvade({ ...BASE, kills: 0, oppKills: 0, dist: 1 })).toBe(false)         // ничья
    expect(shouldEvade({ ...BASE, kills: 0, oppKills: 1, oppWindingUp: true, dist: 1 })).toBe(false)
  })

  it('ведёт + соперник заряжает в LOS → уклоняется', () => {
    expect(shouldEvade({ ...BASE, oppWindingUp: true, hasLOS: true })).toBe(true)
  })

  it('ведёт + заряд, но нет LOS и далеко → не уклоняется', () => {
    expect(shouldEvade({ ...BASE, oppWindingUp: true, hasLOS: false, dist: 100 })).toBe(false)
  })

  it('ведёт + соперник вплотную (dist < evadeNear) → уклоняется даже без заряда', () => {
    expect(shouldEvade({ ...BASE, oppWindingUp: false, dist: 5 })).toBe(true)
  })

  it('ведёт, но соперник далеко и не заряжает → не уклоняется', () => {
    expect(shouldEvade({ ...BASE, oppWindingUp: false, dist: 7 })).toBe(false)
  })
})
