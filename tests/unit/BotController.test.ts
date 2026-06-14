import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player } from '../../src/game/Player'
import { Body } from '../../src/game/Body'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import { Shield } from '../../src/game/Shield'
import { BotController } from '../../src/game/controllers/BotController'
import { botPersonality } from '../../src/game/controllers/botPersonality'
import type { BotPersonality } from '../../src/game/controllers/botPersonality'
import type { World } from '../../src/game/World'
import { EYE_HEIGHT } from '../../src/constants'

// Детерминированная агрессивная личность для тестов: мгновенная реакция, точный прицел
const FAST_PERSONALITY: BotPersonality = {
  reactionMs:   0,
  aimNoise:     0,
  dodgeSkill:   1.0,
  dashRate:     0,
  jumpiness:    0,
  strafeFlipMs: 99999,
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

// --- botPersonality ---

describe('botPersonality', () => {
  it('детерминированность: одно имя → один результат', () => {
    const a = botPersonality('GLITCH')
    const b = botPersonality('GLITCH')
    expect(a).toEqual(b)
  })

  it('разные имена → разные параметры', () => {
    const a = botPersonality('ALPHA')
    const b = botPersonality('OMEGA')
    const diff = (a.reactionMs !== b.reactionMs) || (a.aimNoise !== b.aimNoise) || (a.dodgeSkill !== b.dodgeSkill)
    expect(diff).toBe(true)
  })

  it('все параметры в допустимых диапазонах (100 имён)', () => {
    for (let i = 0; i < 100; i++) {
      const p = botPersonality(`BOT_${i}`)
      expect(p.reactionMs).toBeGreaterThanOrEqual(50)
      expect(p.reactionMs).toBeLessThanOrEqual(250)
      expect(p.aimNoise).toBeGreaterThanOrEqual(0.01)
      expect(p.aimNoise).toBeLessThanOrEqual(0.12)
      expect(p.dodgeSkill).toBeGreaterThanOrEqual(0.1)
      expect(p.dodgeSkill).toBeLessThanOrEqual(0.8)
      expect(p.dashRate).toBeGreaterThanOrEqual(0.03)
      expect(p.dashRate).toBeLessThanOrEqual(0.25)
      expect(p.jumpiness).toBeGreaterThanOrEqual(0.05)
      expect(p.jumpiness).toBeLessThanOrEqual(0.40)
      expect(p.strafeFlipMs).toBeGreaterThanOrEqual(600)
      expect(p.strafeFlipMs).toBeLessThanOrEqual(2000)
    }
  })
})

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
    for (let i = 0; i < 50; i++) bc.update(0.1)   // 5с > BOT_FIRE_INTERVAL(2500мс)
    expect(bot.isWindingUp).toBe(false)
    expect(bot.shieldActive).toBe(false)
  })

  it('нет LOS — не стреляет даже при готовом таймере', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    const bc = makeBot(bot, opp, worldBlocked)
    for (let i = 0; i < 40; i++) bc.update(0.1)   // 4с > BOT_FIRE_INTERVAL
    expect(bot.isWindingUp).toBe(false)
  })

  it('есть LOS, соперник близко (STRAFE) — начинает заряд после BOT_FIRE_INTERVAL', () => {
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
})
