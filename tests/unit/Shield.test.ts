import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Shield } from '../../src/game/Shield'
import type { IShieldFx } from '../../src/game/fx/shield/types'

const DURATION = 800
const COOLDOWN = 2000

/** Фейковый скин: пишет историю active, считает dispose. */
class FakeShieldFx implements IShieldFx {
  readonly object3d = new THREE.Group()
  activeLog: boolean[] = []
  disposed = 0
  update(_dt: number, active: boolean) { this.activeLog.push(active) }
  dispose() { this.disposed++ }
}

/** Прокручивает dt-симуляцию щита на ms миллисекунд маленькими шагами. */
function advance(shield: Shield, ms: number, step = 16) {
  for (let t = 0; t < ms; t += step) shield.update(step / 1000)
}

describe('Shield', () => {
  it('isActive = false изначально', () => {
    expect(new Shield({ duration: DURATION, cooldown: COOLDOWN }).isActive).toBe(false)
  })

  it('activate() включает щит', () => {
    const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
    s.activate()
    expect(s.isActive).toBe(true)
  })

  it('щит выключается после duration и уходит в кулдаун', () => {
    const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
    s.activate()
    advance(s, DURATION + 100)
    expect(s.isActive).toBe(false)
    expect(s.progress()).toBeLessThan(1)
  })

  it('activate() игнорируется во время кулдауна', () => {
    const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
    s.activate()
    advance(s, DURATION + 100) // в кулдауне
    s.activate()
    expect(s.isActive).toBe(false)
  })

  it('progress() = 1 в покое, < 1 при активации', () => {
    const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
    expect(s.progress()).toBe(1)
    s.activate()
    expect(s.progress()).toBeLessThan(1)
  })

  it('reset() возвращает щит в покой', () => {
    const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
    s.activate()
    s.reset()
    expect(s.isActive).toBe(false)
    expect(s.progress()).toBe(1)
  })

  describe('делегирование скину IShieldFx', () => {
    it('fx живёт ребёнком группы щита; update получает active по фазе', () => {
      const fx = new FakeShieldFx()
      const s = new Shield({ duration: DURATION, cooldown: COOLDOWN, shieldFx: fx })
      expect(fx.object3d.parent).toBe(s.object3d)
      s.update(0.016)
      expect(fx.activeLog).toEqual([false])
      s.activate()
      s.update(0.016)
      expect(fx.activeLog).toEqual([false, true])
    })

    it('форс видимости извне (удалённый игрок) → скин анимируется при idle-фазе', () => {
      const fx = new FakeShieldFx()
      const s = new Shield({ duration: DURATION, cooldown: COOLDOWN, shieldFx: fx })
      s.object3d.visible = true   // applyRemoteVisual из снапшота
      s.update(0.016)
      expect(s.isActive).toBe(false)
      expect(fx.activeLog).toEqual([true])
    })

    it('dispose делегируется скину', () => {
      const fx = new FakeShieldFx()
      const s = new Shield({ shieldFx: fx })
      s.dispose()
      expect(fx.disposed).toBe(1)
    })
  })

  describe('Shield · cooldownScale + resetCooldown', () => {
    const step = (sh: Shield, ms: number) => { sh.update(ms / 1000) }
    it('scale 2 удлиняет кулдаун вдвое', () => {
      const sh = new Shield({ duration: 100, cooldown: 200 })
      sh.setCooldownScale(2)
      sh.activate()
      step(sh, 100)   // active истёк → cooldown
      expect(sh.isActive).toBe(false)
      step(sh, 300)   // при scale 2 кулдаун = 400мс, 300 < 400 → ещё cooldown
      sh.activate()
      expect(sh.isActive).toBe(false)
      step(sh, 120)   // суммарно 420 > 400 → idle
      sh.activate()
      expect(sh.isActive).toBe(true)
    })
    it('resetCooldown → сразу можно активировать', () => {
      const sh = new Shield({ duration: 100, cooldown: 200 })
      sh.activate(); step(sh, 100)   // в cooldown
      sh.resetCooldown()
      sh.activate()
      expect(sh.isActive).toBe(true)
    })
    it('resetCooldown во время active → после окна сразу idle, без кулдауна', () => {
      const sh = new Shield({ duration: 100, cooldown: 200 })
      sh.activate()
      sh.resetCooldown()   // взводит skipCooldown
      step(sh, 100)        // active истёк → должен уйти в idle, а не cooldown
      sh.activate()
      expect(sh.isActive).toBe(true)
    })
  })

  describe('Shield · isPerfectBlock (окно идеального блока 100мс)', () => {
    it('false в покое и в кулдауне', () => {
      const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
      expect(s.isPerfectBlock()).toBe(false)   // idle
      s.activate(); advance(s, DURATION + 100)  // cooldown
      expect(s.isPerfectBlock()).toBe(false)
    })
    it('true сразу после активации и в пределах окна', () => {
      const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
      s.activate()
      expect(s.isPerfectBlock()).toBe(true)     // timer 0
      s.update(0.016)
      expect(s.isPerfectBlock()).toBe(true)     // ~16мс ≤ 100
    })
    it('false если щит держат дольше окна', () => {
      const s = new Shield({ duration: DURATION, cooldown: COOLDOWN })
      s.activate(); advance(s, 150)             // ~150мс > 100, ещё active
      expect(s.isActive).toBe(true)
      expect(s.isPerfectBlock()).toBe(false)
    })
  })
})
