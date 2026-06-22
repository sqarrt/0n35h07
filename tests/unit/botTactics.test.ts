import { describe, it, expect } from 'vitest'
import { shouldEvade } from '../../src/game/controllers/botTactics'

const BASE = { kills: 1, oppKills: 0, oppWindingUp: false, hasLOS: true, dist: 100, evadeNear: 6 }

describe('shouldEvade', () => {
  it('not leading on score → never evades', () => {
    expect(shouldEvade({ ...BASE, kills: 0, oppKills: 0, dist: 1 })).toBe(false)         // draw
    expect(shouldEvade({ ...BASE, kills: 0, oppKills: 1, oppWindingUp: true, dist: 1 })).toBe(false)
  })

  it('leading + opponent winding up in LOS → evades', () => {
    expect(shouldEvade({ ...BASE, oppWindingUp: true, hasLOS: true })).toBe(true)
  })

  it('leading + winding up, but no LOS and far → does not evade', () => {
    expect(shouldEvade({ ...BASE, oppWindingUp: true, hasLOS: false, dist: 100 })).toBe(false)
  })

  it('leading + opponent point-blank (dist < evadeNear) → evades even without windup', () => {
    expect(shouldEvade({ ...BASE, oppWindingUp: false, dist: 5 })).toBe(true)
  })

  it('leading, but opponent far and not winding up → does not evade', () => {
    expect(shouldEvade({ ...BASE, oppWindingUp: false, dist: 7 })).toBe(false)
  })
})
