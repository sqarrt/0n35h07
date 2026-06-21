import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player } from '../../src/game/Player'
import { Body } from '../../src/game/Body'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import { Shield } from '../../src/game/Shield'
import { BotController } from '../../src/game/controllers/BotController'
import type { BotPersonality } from '../../src/game/controllers/botPersonality'
import type { World } from '../../src/game/World'
import { EYE_HEIGHT } from '../../src/constants'

// Детерминированная агрессивная личность для тестов: мгновенная реакция, точный прицел
const FAST_PERSONALITY: BotPersonality = {
  skill:          1,
  hitChance:      1,
  fireIntervalMs: 1400,
  reactionMs:     0,
  dodgeSkill:     1.0,
  dashRate:       0,
  jumpiness:      0,
  strafeFlipMs:   99999,
  grazeMargin:    0,
  baitSkill:      0,
  evadeSkill:     0,
}

function makePlayer(id = 0) {
  const p = new Player(id, new Body(id, '#5af'), new BeamWeapon(), new Shield(), '#5af')
  p.respawnAt(new THREE.Vector3(0, EYE_HEIGHT, 0))
  return p
}

/** World-заглушка: LOS есть — первый хит это соперник с targetId */
function worldWithLOS(targetId: number): World {
  return {
    raycast: () => ({ object: { userData: { entityId: targetId } }, point: new THREE.Vector3() }) as any,
  } as unknown as World
}

/** World-заглушка: LOS нет — хит есть, но это стена */
const worldBlocked: World = {
  raycast: () => ({ object: { userData: { entityId: 99 } }, point: new THREE.Vector3() }) as any,
} as unknown as World

function makeBot(bot: Player, opp: Player, world: World, passive = false, personality = FAST_PERSONALITY) {
  return new BotController(bot, () => opp, world, passive, personality)
}

// Личность (детерминизм, диапазоны, инвариант потолка) покрыта в botPersonality.test.ts.

// --- BotController ---

describe('BotController', () => {
  it('passive — не стреляет, не двигается', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    const bc = makeBot(bot, opp, worldWithLOS(opp.id), true)
    for (let i = 0; i < 100; i++) bc.update(0.1)
    expect(bot.isWindingUp).toBe(false)
    const d = bot.consumeDesired()
    expect(d.length()).toBeCloseTo(0)
  })

  it('фаза призрака — не стреляет, не поднимает щит', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -3)
    ;(bot as any).respawning = true
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))
    for (let i = 0; i < 50; i++) bc.update(0.1)   // 5с > fireIntervalMs(1400мс)
    expect(bot.isWindingUp).toBe(false)
    expect(bot.shieldActive).toBe(false)
  })

  it('нет LOS — не стреляет даже при готовом таймере', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    const bc = makeBot(bot, opp, worldBlocked)
    for (let i = 0; i < 40; i++) bc.update(0.1)   // 4с > fireIntervalMs
    expect(bot.isWindingUp).toBe(false)
  })

  it('есть LOS, соперник близко (STRAFE) — начинает заряд после fireIntervalMs', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)   // dist≈5 < BOT_CHASE_DIST(8) → STRAFE
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))
    let started = false
    for (let i = 0; i < 40; i++) { bc.update(0.1); if (bot.isWindingUp) started = true }
    expect(started).toBe(true)
  })

  it('нет LOS во время заряда — отменяет заряд', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    let losOn = true
    const dynamicWorld: World = {
      raycast: () => losOn
        ? ({ object: { userData: { entityId: opp.id } } }) as any
        : ({ object: { userData: { entityId: 99 } } }) as any,
    } as unknown as World
    const bc = makeBot(bot, opp, dynamicWorld)
    let ticks = 0
    while (!bot.isWindingUp && ticks < 60) { bc.update(0.1); ticks++ }
    expect(bot.isWindingUp).toBe(true)
    losOn = false
    bc.update(0.05)
    expect(bot.isWindingUp).toBe(false)
  })

  it('dodge: reactionMs=0, dodgeSkill=1 → dash при windupProgress>BOT_DODGE_THRESH', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    // Shadow property: мокаем windupProgress без доступа к приватному weapon
    Object.defineProperty(opp, 'windupProgress', { get: () => 0.5, configurable: true })
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))
    let dashed = false
    const origDash = bot.dash.bind(bot)
    bot.dash = (dir: THREE.Vector3) => { dashed = true; origDash(dir) }
    bc.update(0.1)   // reactionMs=0 → реагирует в первый же кадр
    expect(dashed).toBe(true)
  })

  it('EVADE: ведёт по очкам + соперник вплотную → авто-bhop (держит прыжок)', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -3)   // dist 3 < BOT_EVADE_NEAR(6)
    bot.kills = 1                          // ведёт
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))
    let jumpHeld = false
    const origJump = bot.setJumpInput.bind(bot)
    bot.setJumpInput = (v: boolean) => { if (v) jumpHeld = true; origJump(v) }
    bc.update(0.05)
    expect(jumpHeld).toBe(true)
  })

  it('EVADE: не ведёт по очкам → без bhop (jumpiness=0)', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -3)
    bot.kills = 0; opp.kills = 0           // ничья
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))
    let jumpHeld = false
    const origJump = bot.setJumpInput.bind(bot)
    bot.setJumpInput = (v: boolean) => { if (v) jumpHeld = true; origJump(v) }
    bc.update(0.05)
    expect(jumpHeld).toBe(false)
  })

  it('развод на щит: поздний заряд + щит соперника → дэш-отмена, затем настоящий выстрел когда щит ушёл', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)   // STRAFE, LOS
    const bc = makeBot(bot, opp, worldWithLOS(opp.id), false, { ...FAST_PERSONALITY, baitSkill: 1 })

    // Симулируем поздний СВОЙ заряд бота
    let winding = true
    Object.defineProperty(bot, 'isWindingUp', { get: () => winding, configurable: true })
    Object.defineProperty(bot, 'windupProgress', { get: () => 0.8, configurable: true })
    // dash прерывает заряд
    let dashed = false
    const origDash = bot.dash.bind(bot)
    bot.dash = (dir: THREE.Vector3) => { dashed = true; winding = false; origDash(dir) }
    // соперник поднял щит
    let oppShield = true
    Object.defineProperty(opp, 'shieldActive', { get: () => oppShield, configurable: true })
    // считаем настоящие выстрелы
    let realShots = 0
    const origFire = bot.startFiring.bind(bot)
    bot.startFiring = () => { realShots++; origFire() }

    bc.update(0.05)
    expect(dashed).toBe(true)              // дэш-отмена заряда
    expect(realShots).toBe(0)              // щит ещё активен — настоящего выстрела нет

    bc.update(0.05)
    expect(realShots).toBe(0)              // щит всё ещё держится

    oppShield = false                       // соперник опустил щит
    bc.update(0.05)
    expect(realShots).toBe(1)              // наказание настоящим выстрелом
  })

  it('развод на дэш-уворот: соперник дэшит во время заряда → тоже дэш-отмена, выстрел после рывка', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    const bc = makeBot(bot, opp, worldWithLOS(opp.id), false, { ...FAST_PERSONALITY, baitSkill: 1 })

    let winding = true
    Object.defineProperty(bot, 'isWindingUp', { get: () => winding, configurable: true })
    Object.defineProperty(bot, 'windupProgress', { get: () => 0.8, configurable: true })
    let dashed = false
    const origDash = bot.dash.bind(bot)
    bot.dash = (dir: THREE.Vector3) => { dashed = true; winding = false; origDash(dir) }
    // соперник уворачивается дэшем (а не щитом)
    let oppDashing = true
    Object.defineProperty(opp, 'dashing', { get: () => oppDashing, configurable: true })
    let realShots = 0
    const origFire = bot.startFiring.bind(bot)
    bot.startFiring = () => { realShots++; origFire() }

    bc.update(0.05)
    expect(dashed).toBe(true)              // развод сработал на дэш-уворот
    expect(realShots).toBe(0)              // соперник ещё в рывке

    oppDashing = false                      // рывок закончился
    bc.update(0.05)
    expect(realShots).toBe(1)              // наказание настоящим выстрелом
  })

  it('низкий baitSkill → не разводит (заряд не отменяется)', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))   // FAST_PERSONALITY: baitSkill=0
    Object.defineProperty(bot, 'isWindingUp', { get: () => true, configurable: true })
    Object.defineProperty(bot, 'windupProgress', { get: () => 0.8, configurable: true })
    Object.defineProperty(opp, 'shieldActive', { get: () => true, configurable: true })
    let dashed = false
    const origDash = bot.dash.bind(bot)
    bot.dash = (dir: THREE.Vector3) => { dashed = true; origDash(dir) }
    bc.update(0.05)
    expect(dashed).toBe(false)
  })
})
