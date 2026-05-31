import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player } from '../../src/game/Player'
import { Body } from '../../src/game/Body'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import { Shield } from '../../src/game/Shield'
import type { IWeapon, WeaponContext, FireOutcome } from '../../src/game/abstractions'
import { MUZZLE_Y } from '../../src/constants'

function makePlayer(id = 1) {
  return new Player(id, 1, new Body(id, '#5af'), new BeamWeapon(), new Shield(), '#5af')
}

const dummyWorld = { raycast: () => null } as any

/** Оружие-заглушка: запоминает направление прицела, переданное из Player.update. */
class StubWeapon implements IWeapon {
  object3d = new THREE.Group()
  isWindingUp = false
  windupProgress = 0
  justFired = false
  outcome: FireOutcome | null = null
  lastAim?: THREE.Vector3
  beginWindup() {}
  update(_dt: number, ctx: WeaponContext) { this.lastAim = ctx.aim.clone() }
  reset() {}
  spawnImpact() {}
  cooldownProgress() { return 1 }
  clearJustFired() {}
  dispose() {}
}

describe('Player', () => {
  it('receiveHit() без щита → killed, alive=false, ставит respawnTimer', () => {
    const p = makePlayer()
    expect(p.receiveHit()).toBe('killed')
    expect(p.alive).toBe(false)
    expect(p.respawnTimer).toBeGreaterThan(0)
  })

  it('receiveHit() с активным щитом → blocked, остаётся жив', () => {
    const p = makePlayer()
    p.activateShield()                 // щит активен сразу после activate()
    expect(p.receiveHit()).toBe('blocked')
    expect(p.alive).toBe(true)
  })

  it('respawnAt() восстанавливает и переставляет', () => {
    const p = makePlayer()
    p.receiveHit()
    p.respawnAt(new THREE.Vector3(3, 1.7, -2))
    expect(p.alive).toBe(true)
    expect(p.position.x).toBe(3)
    expect(p.position.z).toBe(-2)
  })

  it('moveIntent() двигает тело', () => {
    const p = makePlayer()
    const x0 = p.position.x
    p.moveIntent(new THREE.Vector3(2, 0, 0), 1)
    expect(p.position.x).toBeCloseTo(x0 + 2)
  })

  it('startFiring() переводит оружие в зарядку (вшитый кулдаун)', () => {
    const p = makePlayer()
    expect(p.isWindingUp).toBe(false)
    p.startFiring()
    expect(p.isWindingUp).toBe(true)
  })

  // --- регрессии после ООП-рефакторинга ---

  it('луч сходится В ТОЧКУ прицела от дула, а не параллельно (фикс TP)', () => {
    const stub = new StubWeapon()
    const p = new Player(0, 0, new Body(0, '#4af'), stub, new Shield(), '#4af')
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    const point = new THREE.Vector3(0, 1.0, -10)        // ниже линии глаз
    p.aim(point)
    p.update(0.016, dummyWorld, [])
    const muzzle = new THREE.Vector3(0, 1.7 + MUZZLE_Y, 0)
    const expected = point.clone().sub(muzzle).normalize()
    expect(stub.lastAim!.x).toBeCloseTo(expected.x)
    expect(stub.lastAim!.y).toBeCloseTo(expected.y)
    expect(stub.lastAim!.z).toBeCloseTo(expected.z)
    expect(stub.lastAim!.y).toBeLessThan(0)             // целимся вниз — не параллельно
  })

  it('в FP (тело скрыто) пузырь щита не рисуется (фикс FP)', () => {
    const shield = new Shield()
    const p = new Player(0, 0, new Body(0, '#4af'), new StubWeapon(), shield, '#4af')
    p.setBodyVisible(false)
    p.activateShield()
    p.update(0.016, dummyWorld, [])
    expect(shield.object3d.visible).toBe(false)         // скрыт, хотя щит активен
    p.setBodyVisible(true)
    p.update(0.016, dummyWorld, [])
    expect(shield.object3d.visible).toBe(true)          // в TP виден
  })

  it('во время заряда физика прыжка замедляется (фикс приземления)', () => {
    // Заряжающийся интегрирует физику медленнее (dt*factor) → за то же число кадров
    // проходит по дуге меньше (и в итоге дольше в воздухе — как было до рефакторинга).
    const normal = makePlayer()
    const charging = makePlayer()
    normal.respawnAt(new THREE.Vector3(0, 1.7, 0))
    charging.respawnAt(new THREE.Vector3(0, 1.7, 0))
    normal.jump(); charging.jump()
    charging.startFiring()                             // заряжается → физика замедлена
    for (let i = 0; i < 12; i++) {                     // ~190мс < windup 400
      normal.update(0.016, dummyWorld, [])
      charging.update(0.016, dummyWorld, [])
    }
    // без фикса обе позиции совпали бы (полный dt); с фиксом заряжающийся продвинулся меньше
    expect(charging.position.y).toBeLessThan(normal.position.y)
  })
})
