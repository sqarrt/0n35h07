import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import type { WeaponContext } from '../../src/game/abstractions'

const WINDUP = 400
const COOLDOWN = 1500

function ctx(raycast: WeaponContext['world']['raycast']): WeaponContext {
  return {
    world: { raycast } as any,
    muzzle: new THREE.Vector3(0, 0, 0),
    aim: new THREE.Vector3(0, 0, -1),
    excludeIds: [],
  }
}

function advance(w: BeamWeapon, c: WeaponContext, ms: number, step = 16) {
  for (let t = 0; t < ms; t += step) w.update(step / 1000, c)
}

describe('BeamWeapon', () => {
  it('покой: не заряжается, кулдаун готов', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    expect(w.isWindingUp).toBe(false)
    expect(w.windupProgress).toBe(0)
    expect(w.cooldownProgress()).toBe(1)
  })

  it('beginWindup() запускает зарядку, прогресс растёт', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    const c = ctx(() => null)
    w.beginWindup()
    advance(w, c, 200)
    expect(w.isWindingUp).toBe(true)
    expect(w.windupProgress).toBeGreaterThan(0)
    expect(w.justFired).toBe(false)
  })

  it('выстрел по достижении windup; промах → луч на 100 единиц', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    const c = ctx(() => null)
    w.beginWindup()
    advance(w, c, WINDUP + 50)
    expect(w.justFired).toBe(true)
    expect(w.isWindingUp).toBe(false)
    expect(w.cooldownProgress()).toBeLessThan(1)
    expect(w.outcome?.hitEntityId).toBeNull()
    expect(w.outcome?.end.z).toBeCloseTo(-100, 0)
  })

  it('попадание в сущность → outcome.hitEntityId', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    const hit = { point: new THREE.Vector3(0, 0, -5), object: { userData: { entityId: 2 } } }
    const c = ctx(() => hit as any)
    w.beginWindup()
    advance(w, c, WINDUP + 50)
    expect(w.outcome?.hitEntityId).toBe(2)
    expect(w.outcome?.hitPoint).not.toBeNull()
  })

  it('повторный beginWindup во время кулдауна игнорируется', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    const c = ctx(() => null)
    w.beginWindup()
    advance(w, c, WINDUP + 50)
    w.clearJustFired()
    w.beginWindup()
    expect(w.isWindingUp).toBe(false)
  })

  it('interrupt() из windup → cooldown без выстрела', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    w.beginWindup()
    w.interrupt()
    expect(w.isWindingUp).toBe(false)
    expect(w.justFired).toBe(false)
    expect(w.cooldownProgress()).toBeLessThan(1)
  })

  it('interrupt() вне windup — no-op', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    w.interrupt()
    expect(w.cooldownProgress()).toBe(1)
  })

  it('делегирует визуал в инжектированный IBeamFx: play при выстреле/playBeam, update каждый кадр, reset', () => {
    const fake = {
      object3d: new THREE.Group(),
      plays: [] as { start: THREE.Vector3; end: THREE.Vector3 }[],
      updates: 0, resets: 0,
      play(s: THREE.Vector3, e: THREE.Vector3) { this.plays.push({ start: s.clone(), end: e.clone() }) },
      update() { this.updates++ },
      reset() { this.resets++ },
      dispose() {},
    }
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN, beamFx: fake })
    const c = ctx(() => null)
    w.beginWindup()
    advance(w, c, WINDUP + 50)
    expect(fake.plays.length).toBe(1)                       // выстрел → play
    expect(fake.plays[0].end.z).toBeCloseTo(-100, 0)        // промах → конец на дальности
    expect(fake.updates).toBeGreaterThan(0)                 // update — каждый кадр
    w.playBeam(new THREE.Vector3(), new THREE.Vector3(0, 0, -5))
    expect(fake.plays.length).toBe(2)                       // косметический выстрел → play
    w.reset()
    expect(fake.resets).toBe(1)
  })
})
