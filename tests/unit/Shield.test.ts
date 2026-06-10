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
})
