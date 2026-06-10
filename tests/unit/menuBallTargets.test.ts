import { describe, it, expect } from 'vitest'
import { resolveTarget, offscreenX } from '../../src/components/menuBallTargets'

const vp = { width: 10, height: 6 }

describe('resolveTarget', () => {
  it('center и кромки: z=0, x по позиции', () => {
    expect(resolveTarget('center', vp).x).toBe(0)
    expect(resolveTarget('center', vp).z).toBe(0)
    expect(resolveTarget('left-edge', vp).x).toBe(-vp.width / 2)
    expect(resolveTarget('right-edge', vp).x).toBe(vp.width / 2)
  })

  it('settings-left: слева, z=0', () => {
    const t = resolveTarget('settings-left', vp)
    expect(t.x).toBeLessThan(0)
    expect(t.z).toBe(0)
    expect(t.scale).toBeGreaterThan(0)
  })

  it('shot-left: тот же x/scale, что settings-left, но отодвинут от камеры (z<0)', () => {
    const s = resolveTarget('settings-left', vp)
    const t = resolveTarget('shot-left', vp)
    expect(t.x).toBe(s.x)
    expect(t.scale).toBe(s.scale)
    expect(t.z).toBeLessThan(0)
  })
})

describe('offscreenX', () => {
  it('right-edge стартует справа за кадром, остальные — слева', () => {
    expect(offscreenX('right-edge', vp)).toBe(vp.width)
    expect(offscreenX('settings-left', vp)).toBe(-vp.width)
  })
})
