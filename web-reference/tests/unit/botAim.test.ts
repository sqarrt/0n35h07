import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { rollHit, aimPoint } from '../../src/game/controllers/botAim'
import { BALL_RADIUS } from '../../src/constants'

describe('rollHit', () => {
  it('rng < hitChance → hit', () => {
    expect(rollHit(0.8, () => 0.0)).toBe(true)
    expect(rollHit(0.8, () => 0.79)).toBe(true)
  })
  it('rng >= hitChance → miss', () => {
    expect(rollHit(0.8, () => 0.8)).toBe(false)
    expect(rollHit(0.8, () => 0.99)).toBe(false)
  })
  it('hitChance=0 always misses, =1 always hits', () => {
    expect(rollHit(0, () => 0)).toBe(false)
    expect(rollHit(1, () => 0.999)).toBe(true)
  })
})

describe('aimPoint', () => {
  const shooter = new THREE.Vector3(0, 1.5, 0)
  const base = new THREE.Vector3(0, 1.5, -10)

  it('hit=true → exactly the target center', () => {
    const out = aimPoint(new THREE.Vector3(), base, shooter, true, 0.5)
    expect(out.equals(base)).toBe(true)
  })

  it('near-miss: offset exactly BALL_RADIUS*(1+grazeMargin) and perpendicular to the line of fire', () => {
    const grazeMargin = 0.3
    const out = aimPoint(new THREE.Vector3(), base, shooter, false, grazeMargin, () => 0.123)
    const offset = out.clone().sub(base)
    expect(offset.length()).toBeCloseTo(BALL_RADIUS * (1 + grazeMargin), 5)
    // perpendicular to the shooter→base direction
    const dir = base.clone().sub(shooter).normalize()
    expect(offset.dot(dir)).toBeCloseTo(0, 5)
  })

  it('smaller grazeMargin (stronger bot) → closer to center', () => {
    const strong = aimPoint(new THREE.Vector3(), base, shooter, false, 0.15, () => 0.4)
    const weak   = aimPoint(new THREE.Vector3(), base, shooter, false, 0.90, () => 0.4)
    expect(strong.clone().sub(base).length()).toBeLessThan(weak.clone().sub(base).length())
  })

  it('different rng angle → different points on the miss circle', () => {
    const a = aimPoint(new THREE.Vector3(), base, shooter, false, 0.3, () => 0.0)
    const b = aimPoint(new THREE.Vector3(), base, shooter, false, 0.3, () => 0.25)
    expect(a.equals(b)).toBe(false)
  })
})
