import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player } from '../../src/game/Player'
import { Body } from '../../src/game/Body'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import { Shield } from '../../src/game/Shield'
import type { IWeapon, WeaponContext, FireOutcome } from '../../src/game/abstractions'
import { MUZZLE_Y, MOVE_SPEED, RESPAWN_SPEED_MULT } from '../../src/constants'
import type { IWindupFx, WindupTarget, WindupFrame } from '../../src/game/fx/windup/types'

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
    p.stepHorizontal(0.016, null)   // скоростная модель реализует намерение в desired
    expect(p.consumeDesired().x).toBeGreaterThan(0)
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
    p.stepHorizontal(0.016, null)
    expect(p.consumeDesired().x).toBeGreaterThan(0)  // разморозили — двигается
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

  it('смерть запускает фазу призрака: alive=false, isRespawning, атака заблокирована', () => {
    const p = makePlayer()
    expect(p.receiveHit()).toBe('killed')
    expect(p.alive).toBe(false)
    expect(p.isRespawning).toBe(true)
    p.startFiring();    expect(p.isWindingUp).toBe(false)   // стрелять нельзя
    p.activateShield(); expect(p.shieldActive).toBe(false)  // щит нельзя
  })

  it('призрак движется в RESPAWN_SPEED_MULT раз быстрее обычного', () => {
    const live = makePlayer()
    live.moveIntent(new THREE.Vector3(MOVE_SPEED, 0, 0), 1)
    const liveDx = live.consumeDesired().x

    const ghost = makePlayer()
    ghost.receiveHit()
    ghost.moveIntent(new THREE.Vector3(MOVE_SPEED, 0, 0), 1)
    expect(ghost.consumeDesired().x).toBeCloseTo(liveDx * RESPAWN_SPEED_MULT)
  })

  it('повторный hit по призраку — blocked (нет двойного килла)', () => {
    const p = makePlayer()
    expect(p.receiveHit()).toBe('killed')
    expect(p.receiveHit()).toBe('blocked')
  })

  it('respawnAt материализует на месте: alive, !isRespawning, атака снова доступна', () => {
    const p = makePlayer()
    p.receiveHit()
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    expect(p.alive).toBe(true)
    expect(p.isRespawning).toBe(false)
    p.startFiring(); expect(p.isWindingUp).toBe(true)
  })

  it('возрождение сбрасывает ВСЕ кулдауны (луч/щит/дэш готовы)', () => {
    const p = makePlayer()
    p.startFiring()
    p.update(0.5, dummyWorld, [])            // > windup → выстрел → кулдаун луча
    p.activateShield()                        // щит → кулдаун
    p.dash(new THREE.Vector3(0, 0, -1))       // дэш → кулдаун
    expect(p.beamCooldownProgress()).toBeLessThan(1)
    expect(p.dashCooldownProgress()).toBeLessThan(1)

    p.receiveHit()                            // смерть → призрак
    p.respawnAt(new THREE.Vector3(0, 1.7, 0)) // материализация
    expect(p.beamCooldownProgress()).toBe(1)
    expect(p.shieldProgress()).toBe(1)
    expect(p.dashCooldownProgress()).toBe(1)
  })
})

/** Фейковая стратегия: записывает последний кадр. */
class FakeWindupFx implements IWindupFx {
  object3d = new THREE.Group()
  lastFrame: WindupFrame | null = null
  apply(_dt: number, _t: WindupTarget, f: WindupFrame) { this.lastFrame = { ...f } }
  dispose() {}
}

describe('Player + IWindupFx', () => {
  it('дефолт — classic (без явного fx Player создаётся и ведёт себя как раньше)', () => {
    const p = makePlayer()
    expect(p.windupStyle).toBe('classic')
    expect(p.windupFxObject).toBeDefined()
  })

  it('прокидывает progress заряда в стратегию', () => {
    const stub = new StubWeapon()
    const fx = new FakeWindupFx()
    const p = new Player(0, new Body(0, '#4af'), stub, new Shield(), '#4af', fx, 'rage')
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    stub.windupProgress = 0.6
    p.update(0.016, dummyWorld, [])
    expect(p.windupStyle).toBe('rage')
    expect(fx.lastFrame!.progress).toBeCloseTo(0.6)
    expect(fx.lastFrame!.visible).toBe(true)
  })

  it('призрак (смерть) скрывает world-объект стратегии', () => {
    const fx = new FakeWindupFx()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af', fx, 'classic')
    fx.object3d.visible = true
    p.receiveHit()
    p.update(0.016, dummyWorld, [])
    expect(fx.object3d.visible).toBe(false)
  })

  it('призрак скрывает world-объект и в updateRemote (сетевой путь)', () => {
    const fx = new FakeWindupFx()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af', fx, 'classic')
    fx.object3d.visible = true
    p.receiveHit()
    p.updateRemote(0.016, dummyWorld)
    expect(fx.object3d.visible).toBe(false)
  })
})

import type { IRespawnFx, RespawnTarget, RespawnFrame } from '../../src/game/fx/respawn/types'

/** Фейковая стратегия респавна: пишет события и последний кадр. */
class FakeRespawnFx implements IRespawnFx {
  object3d = new THREE.Group()
  ownGhostTrail = false
  deaths: THREE.Vector3[] = []
  lastFrame: RespawnFrame | null = null
  onDeath(p: THREE.Vector3) { this.deaths.push(p.clone()) }
  apply(_dt: number, _t: RespawnTarget, f: RespawnFrame) { this.lastFrame = { ...f } }
  isRebirthActive() { return false }
  update() {}
  dispose() {}
}

describe('Player + IRespawnFx', () => {
  it('дефолт — echo, world-объект доступен', () => {
    const p = makePlayer()
    expect(p.respawnStyle).toBe('echo')
    expect(p.respawnFxObject).toBeDefined()
  })

  it('смерть дёргает onDeath; кадр призрака прокидывает ghost-прогресс', () => {
    const fx = new FakeRespawnFx()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af',
      undefined, undefined, fx, 'chaos')
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    p.receiveHit()
    expect(fx.deaths.length).toBe(1)
    p.update(0.016, dummyWorld, [])
    expect(fx.lastFrame!.ghost).toBeGreaterThan(0.9)            // фаза только началась (остаток ~1)
    expect(p.respawnStyle).toBe('chaos')
  })

  it('после respawnAt кадр уходит из ghost (ghost=null, sinceRebirthMs мал)', () => {
    const fx = new FakeRespawnFx()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af',
      undefined, undefined, fx, 'echo')
    p.receiveHit()
    p.respawnAt(new THREE.Vector3(1, 1.7, 1))
    p.update(0.016, dummyWorld, [])
    expect(fx.lastFrame!.ghost).toBeNull()
    expect(fx.lastFrame!.sinceRebirthMs).toBeLessThan(1000)
  })
})

import type { IDashTrail, DashTrailContext } from '../../src/game/abstractions'

/** Фейковый след рывка: пишет dashing-флаги, которые видел. */
class FakeDashTrail implements IDashTrail {
  object3d = new THREE.Group()
  aliveCount = 0
  dashingLog: boolean[] = []
  update(_dt: number, ctx: DashTrailContext) { this.dashingLog.push(ctx.dashing) }
  dispose() {}
}

describe('Player + IDashTrail (скин следа рывка)', () => {
  it('дефолт — streak, world-объект доступен', () => {
    const p = makePlayer()
    expect(p.dashStyle).toBe('streak')
    expect(p.trailObject).toBeDefined()
  })

  it('инжектированный трейл получает dashing=true в кадре рывка', () => {
    const fx = new FakeDashTrail()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af',
      undefined, undefined, undefined, undefined, fx, 'wave')
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    p.update(0.016, dummyWorld, [])
    expect(fx.dashingLog).toEqual([false])
    p.dash(new THREE.Vector3(1, 0, 0))
    p.update(0.016, dummyWorld, [])
    expect(fx.dashingLog).toEqual([false, true])
    expect(p.dashStyle).toBe('wave')
    expect(p.trailObject).toBe(fx.object3d)
  })

  it('призрак НЕ переиспользует скин рывка: у призрака свой классический трейл', () => {
    const fx = new FakeDashTrail()
    const p = new Player(0, new Body(0, '#4af'), new StubWeapon(), new Shield(), '#4af',
      undefined, undefined, undefined, undefined, fx, 'rift')
    p.respawnAt(new THREE.Vector3(0, 1.7, 0))
    p.receiveHit()                                  // фаза призрака (echo — общий след)
    p.update(0.016, dummyWorld, [])
    expect(fx.dashingLog).toEqual([false])          // скин рывка молчит — след призрака рисует ghostTrail
    expect(p.ghostTrailObject).not.toBe(fx.object3d)
  })
})
