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
  it('idle: not winding up, cooldown ready', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    expect(w.isWindingUp).toBe(false)
    expect(w.windupProgress).toBe(0)
    expect(w.cooldownProgress()).toBe(1)
  })

  it('beginWindup() starts the windup, progress grows', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    const c = ctx(() => null)
    w.beginWindup()
    advance(w, c, 200)
    expect(w.isWindingUp).toBe(true)
    expect(w.windupProgress).toBeGreaterThan(0)
    expect(w.justFired).toBe(false)
  })

  it('fires on reaching windup; miss → beam at 100 units', () => {
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

  it('hit on an entity → outcome.hitEntityId', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    const hit = { point: new THREE.Vector3(0, 0, -5), object: { userData: { entityId: 2 } } }
    const c = ctx(() => hit as any)
    w.beginWindup()
    advance(w, c, WINDUP + 50)
    expect(w.outcome?.hitEntityId).toBe(2)
    expect(w.outcome?.hitPoint).not.toBeNull()
  })

  it('hitOrigin/hitDir set → hit raycast from them (aim ray), visual — from the muzzle', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    let gotOrigin: THREE.Vector3 | null = null
    let gotDir: THREE.Vector3 | null = null
    const c: WeaponContext = {
      world: { raycast: (o: THREE.Vector3, d: THREE.Vector3) => { gotOrigin = o.clone(); gotDir = d.clone(); return null } } as any,
      muzzle: new THREE.Vector3(0, 5, 0),     // muzzle
      aim: new THREE.Vector3(0, 0, -1),
      excludeIds: [],
      hitOrigin: new THREE.Vector3(3, 1, 3),  // camera (TP, behind)
      hitDir: new THREE.Vector3(1, 0, 0),
    }
    w.beginWindup()
    advance(w, c, WINDUP + 50)
    expect(gotOrigin!.x).toBeCloseTo(3); expect(gotOrigin!.y).toBeCloseTo(1); expect(gotOrigin!.z).toBeCloseTo(3)
    expect(gotDir!.x).toBeCloseTo(1)        // raycast followed hitDir, not aim(-Z)
    expect(w.outcome?.end.y).toBeCloseTo(5) // beam visual still from the muzzle (y=5)
  })

  it('without hitOrigin → hit raycast from the muzzle along aim (bot/remote)', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    let gotOrigin: THREE.Vector3 | null = null
    const c: WeaponContext = {
      world: { raycast: (o: THREE.Vector3) => { gotOrigin = o.clone(); return null } } as any,
      muzzle: new THREE.Vector3(7, 2, 7),
      aim: new THREE.Vector3(0, 0, -1),
      excludeIds: [],
    }
    w.beginWindup()
    advance(w, c, WINDUP + 50)
    expect(gotOrigin!.x).toBeCloseTo(7); expect(gotOrigin!.y).toBeCloseTo(2); expect(gotOrigin!.z).toBeCloseTo(7)
  })

  it('repeat beginWindup during cooldown is ignored', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    const c = ctx(() => null)
    w.beginWindup()
    advance(w, c, WINDUP + 50)
    w.clearJustFired()
    w.beginWindup()
    expect(w.isWindingUp).toBe(false)
  })

  it('interrupt() from windup → idle without firing and WITHOUT cooldown (no beam happened)', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    w.beginWindup()
    w.interrupt()
    expect(w.isWindingUp).toBe(false)
    expect(w.justFired).toBe(false)
    expect(w.cooldownProgress()).toBe(1)   // not in cooldown → can wind up again right away
  })

  it('interrupt() outside windup — no-op', () => {
    const w = new BeamWeapon({ windupDuration: WINDUP, cooldownDuration: COOLDOWN })
    w.interrupt()
    expect(w.cooldownProgress()).toBe(1)
  })

  it('delegates visuals to the injected IBeamFx: play on fire/playBeam, update every frame, reset', () => {
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
    expect(fake.plays.length).toBe(1)                       // fire → play
    expect(fake.plays[0].end.z).toBeCloseTo(-100, 0)        // miss → end at max range
    expect(fake.updates).toBeGreaterThan(0)                 // update — every frame
    w.playBeam(new THREE.Vector3(), new THREE.Vector3(0, 0, -5))
    expect(fake.plays.length).toBe(2)                       // cosmetic shot → play
    w.reset()
    expect(fake.resets).toBe(1)
  })
})
