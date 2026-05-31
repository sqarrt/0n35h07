import { describe, it, expect } from 'vitest'
import { Shield } from '../../src/game/Shield'

const DURATION = 800
const COOLDOWN = 2000

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
})
