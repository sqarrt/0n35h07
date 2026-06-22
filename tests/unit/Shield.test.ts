import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Shield } from '../../src/game/Shield'
import type { IShieldFx } from '../../src/game/fx/shield/types'

const DURATION = 800
const COOLDOWN = 2000

/** Fake skin: records the active history, counts dispose. */
class FakeShieldFx implements IShieldFx {
  readonly object3d = new THREE.Group()
  activeLog: boolean[] = []
  disposed = 0
  update(_dt: number, active: boolean) { this.activeLog.push(active) }
  dispose() { this.disposed++ }
}

/** Advances the shield's dt-simulation by ms milliseconds in small steps. */
function advance(shield: Shield, ms: number, step = 16) {
  for (let t = 0; t < ms; t += step) shield.update(step / 1000)
}

describe('Shield', () => {
  it('isActive = false initially', () => {
    expect(new Shield({ duration: DURATION, cooldown: COOLDOWN }).isActive).toBe(false)
  })

  it('activate() turns the shield on', () => {
    const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
    s.activate()
    expect(s.isActive).toBe(true)
  })

  it('shield turns off after duration and goes into cooldown', () => {
    const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
    s.activate()
    advance(s, DURATION + 100)
    expect(s.isActive).toBe(false)
    expect(s.progress()).toBeLessThan(1)
  })

  it('activate() is ignored during cooldown', () => {
    const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
    s.activate()
    advance(s, DURATION + 100) // in cooldown
    s.activate()
    expect(s.isActive).toBe(false)
  })

  it('progress() = 1 at rest, < 1 when activated', () => {
    const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
    expect(s.progress()).toBe(1)
    s.activate()
    expect(s.progress()).toBeLessThan(1)
  })

  it('reset() returns the shield to rest', () => {
    const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
    s.activate()
    s.reset()
    expect(s.isActive).toBe(false)
    expect(s.progress()).toBe(1)
  })

  describe('delegation to the IShieldFx skin', () => {
    it('fx lives as a child of the shield group; update receives active by phase', () => {
      const fx = new FakeShieldFx()
      const s = new Shield({ duration: DURATION, cooldown: COOLDOWN, shieldFx: fx })
      expect(fx.object3d.parent).toBe(s.object3d)
      s.update(0.016)
      expect(fx.activeLog).toEqual([false])
      s.activate()
      s.update(0.016)
      expect(fx.activeLog).toEqual([false, true])
    })

    it('external visibility force (remote player) → skin animates in the idle phase', () => {
      const fx = new FakeShieldFx()
      const s = new Shield({ duration: DURATION, cooldown: COOLDOWN, shieldFx: fx })
      s.object3d.visible = true   // applyRemoteVisual from a snapshot
      s.update(0.016)
      expect(s.isActive).toBe(false)
      expect(fx.activeLog).toEqual([true])
    })

    it('dispose is delegated to the skin', () => {
      const fx = new FakeShieldFx()
      const s = new Shield({ shieldFx: fx })
      s.dispose()
      expect(fx.disposed).toBe(1)
    })
  })

  describe('Shield · cooldownScale + resetCooldown', () => {
    const step = (sh: Shield, ms: number) => { sh.update(ms / 1000) }
    it('scale 2 doubles the cooldown', () => {
      const sh = new Shield({ duration: 100, cooldown: 200 })
      sh.setCooldownScale(2)
      sh.activate()
      step(sh, 100)   // active expired → cooldown
      expect(sh.isActive).toBe(false)
      step(sh, 300)   // at scale 2 cooldown = 400ms, 300 < 400 → still cooldown
      sh.activate()
      expect(sh.isActive).toBe(false)
      step(sh, 120)   // total 420 > 400 → idle
      sh.activate()
      expect(sh.isActive).toBe(true)
    })
    it('resetCooldown → can activate immediately', () => {
      const sh = new Shield({ duration: 100, cooldown: 200 })
      sh.activate(); step(sh, 100)   // in cooldown
      sh.resetCooldown()
      sh.activate()
      expect(sh.isActive).toBe(true)
    })
    it('resetCooldown during active → goes straight to idle after the window, no cooldown', () => {
      const sh = new Shield({ duration: 100, cooldown: 200 })
      sh.activate()
      sh.resetCooldown()   // arms skipCooldown
      step(sh, 100)        // active expired → should go to idle, not cooldown
      sh.activate()
      expect(sh.isActive).toBe(true)
    })
  })

  describe('Shield · isPerfectBlock (100ms perfect-block window)', () => {
    it('false at rest and in cooldown', () => {
      const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
      expect(s.isPerfectBlock()).toBe(false)   // idle
      s.activate(); advance(s, DURATION + 100)  // cooldown
      expect(s.isPerfectBlock()).toBe(false)
    })
    it('true right after activation and within the window', () => {
      const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
      s.activate()
      expect(s.isPerfectBlock()).toBe(true)     // timer 0
      s.update(0.016)
      expect(s.isPerfectBlock()).toBe(true)     // ~16ms ≤ 100
    })
    it('false if the shield is held longer than the window', () => {
      const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
      s.activate(); advance(s, 150)             // ~150ms > 100, still active
      expect(s.isActive).toBe(true)
      expect(s.isPerfectBlock()).toBe(false)
    })
  })
})
