import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { Player } from '../../src/game/Player'
import { Body } from '../../src/game/Body'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import { Shield } from '../../src/game/Shield'
import type { IWeapon, WeaponContext, FireOutcome } from '../../src/game/abstractions'
import { MUZZLE_Y, DEATH_ANIM_MS, SPAWN_ANIM_MS } from '../../src/constants'

function makePlayer(id = 1) {
  return new Player(id, new Body(id, '#5af'), new BeamWeapon(), new Shield(), '#5af')
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
  interrupt() {}
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

  it('moveIntent() копит намерение (интеграцию делает Rapier KCC)', () => {
    const p = makePlayer()
    p.moveIntent(new THREE.Vector3(2, 0, 0), 1)
    expect(p.consumeDesired().x).toBeCloseTo(2)
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
    const p = new Player(0, new Body(0, '#4af'), stub, new Shield(), '#4af')
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
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), shield, '#4af')
    p.setBodyVisible(false)
    p.activateShield()
    p.update(0.016, dummyWorld, [])
    expect(shield.object3d.visible).toBe(false)         // скрыт, хотя щит активен
    p.setBodyVisible(true)
    p.update(0.016, dummyWorld, [])
    expect(shield.object3d.visible).toBe(true)          // в TP виден
  })

  it('setFrozen(true) подавляет движение/выстрел/щит, но не прицел', () => {
    const p = makePlayer()
    p.setFrozen(true)
    p.moveIntent(new THREE.Vector3(5, 0, 0), 1)
    expect(p.consumeDesired().x).toBe(0)         // движение заморожено
    p.startFiring()
    expect(p.isWindingUp).toBe(false)            // выстрел заморожен
    p.activateShield()
    expect(p.shieldActive).toBe(false)           // щит заморожен
    p.setFrozen(false)
    p.moveIntent(new THREE.Vector3(5, 0, 0), 1)
    expect(p.consumeDesired().x).toBeCloseTo(5)  // разморозили — двигается
  })

  it('в FP (тело скрыто) свой след дэша не рисуется', () => {
    const p = makePlayer()
    p.setBodyVisible(false)
    expect(p.trailObject.visible).toBe(false)   // камера внутри тела — клоны не показываем
    p.setBodyVisible(true)
    expect(p.trailObject.visible).toBe(true)     // в TP / у других игроков виден
  })

  it('dash во время заряда прерывает выстрел (оружие в кулдаун)', () => {
    const p = makePlayer()
    p.startFiring()
    expect(p.isWindingUp).toBe(true)
    p.dash(new THREE.Vector3(0, 0, -1))
    expect(p.isWindingUp).toBe(false)
    expect(p.beamCooldownProgress()).toBeLessThan(1)
  })

  it('dash без направления — не рвёт и не прерывает заряд', () => {
    const p = makePlayer()
    p.startFiring()
    p.dash(new THREE.Vector3(0, 0, 0))
    expect(p.isWindingUp).toBe(true)
  })

  it('смерть: тело сдувается к нулю за DEATH_ANIM_MS', () => {
    const t0 = 1_000_000
    const spy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    const p = makePlayer()
    expect(p.receiveHit()).toBe('killed')
    spy.mockReturnValue(t0 + DEATH_ANIM_MS + 10)
    p.update(0.016, dummyWorld, [])
    expect(p.bodyScale).toBeLessThan(0.05)        // сдулся почти в ноль
    spy.mockRestore()
  })

  it('повторный hit по мёртвому/сдувающемуся — blocked (нет двойного килла)', () => {
    const p = makePlayer()
    expect(p.receiveHit()).toBe('killed')
    expect(p.receiveHit()).toBe('blocked')
  })

  it('респаун: тело растёт из нуля с перелётом выше 1, затем оседает к 1', () => {
    const t0 = 2_000_000
    const spy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    const p = makePlayer()
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    spy.mockReturnValue(t0 + 1)
    p.update(0.016, dummyWorld, [])
    expect(p.bodyScale).toBeLessThan(0.2)         // только начал расти из нуля
    spy.mockReturnValue(t0 + SPAWN_ANIM_MS * 0.7)
    p.update(0.016, dummyWorld, [])
    expect(p.bodyScale).toBeGreaterThan(1)        // упругий перелёт выше 1.0
    spy.mockReturnValue(t0 + SPAWN_ANIM_MS + 10)
    p.update(0.016, dummyWorld, [])
    expect(p.bodyScale).toBeCloseTo(1)            // осел на 1
    spy.mockRestore()
  })
})
