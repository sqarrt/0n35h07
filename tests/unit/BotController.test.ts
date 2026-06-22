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

// Deterministic aggressive personality for tests: instant reaction, precise aim
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

/** World stub: LOS present — the first hit is the opponent with targetId */
function worldWithLOS(targetId: number): World {
  return {
    raycast: () => ({ object: { userData: { entityId: targetId } }, point: new THREE.Vector3() }) as any,
  } as unknown as World
}

/** World stub: no LOS — there is a hit, but it is a wall */
const worldBlocked: World = {
  raycast: () => ({ object: { userData: { entityId: 99 } }, point: new THREE.Vector3() }) as any,
} as unknown as World

function makeBot(bot: Player, opp: Player, world: World, passive = false, personality = FAST_PERSONALITY) {
  return new BotController(bot, () => opp, world, passive, personality)
}

// Personality (determinism, ranges, cap invariant) is covered in botPersonality.test.ts.

// --- BotController ---

describe('BotController', () => {
  it('passive — does not fire, does not move', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    const bc = makeBot(bot, opp, worldWithLOS(opp.id), true)
    for (let i = 0; i < 100; i++) bc.update(0.1)
    expect(bot.isWindingUp).toBe(false)
    const d = bot.consumeDesired()
    expect(d.length()).toBeCloseTo(0)
  })

  it('ghost phase — does not fire, does not raise the shield', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -3)
    ;(bot as any).respawning = true
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))
    for (let i = 0; i < 50; i++) bc.update(0.1)   // 5s > fireIntervalMs(1400ms)
    expect(bot.isWindingUp).toBe(false)
    expect(bot.shieldActive).toBe(false)
  })

  it('no LOS — does not fire even with the timer ready', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    const bc = makeBot(bot, opp, worldBlocked)
    for (let i = 0; i < 40; i++) bc.update(0.1)   // 4s > fireIntervalMs
    expect(bot.isWindingUp).toBe(false)
  })

  it('LOS present, opponent close (STRAFE) — starts winding up after fireIntervalMs', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)   // dist≈5 < BOT_CHASE_DIST(8) → STRAFE
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))
    let started = false
    for (let i = 0; i < 40; i++) { bc.update(0.1); if (bot.isWindingUp) started = true }
    expect(started).toBe(true)
  })

  it('no LOS during windup — cancels the windup', () => {
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

  it('dodge: reactionMs=0, dodgeSkill=1 → dash when windupProgress>BOT_DODGE_THRESH', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    // Shadow property: mock windupProgress without accessing the private weapon
    Object.defineProperty(opp, 'windupProgress', { get: () => 0.5, configurable: true })
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))
    let dashed = false
    const origDash = bot.dash.bind(bot)
    bot.dash = (dir: THREE.Vector3) => { dashed = true; origDash(dir) }
    bc.update(0.1)   // reactionMs=0 → reacts on the very first frame
    expect(dashed).toBe(true)
  })

  it('EVADE: leading on score + opponent point-blank → auto-bhop (holds the jump)', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -3)   // dist 3 < BOT_EVADE_NEAR(6)
    bot.kills = 1                          // leading
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))
    let jumpHeld = false
    const origJump = bot.setJumpInput.bind(bot)
    bot.setJumpInput = (v: boolean) => { if (v) jumpHeld = true; origJump(v) }
    bc.update(0.05)
    expect(jumpHeld).toBe(true)
  })

  it('EVADE: not leading on score → no bhop (jumpiness=0)', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -3)
    bot.kills = 0; opp.kills = 0           // tie
    const bc = makeBot(bot, opp, worldWithLOS(opp.id))
    let jumpHeld = false
    const origJump = bot.setJumpInput.bind(bot)
    bot.setJumpInput = (v: boolean) => { if (v) jumpHeld = true; origJump(v) }
    bc.update(0.05)
    expect(jumpHeld).toBe(false)
  })

  it('shield bait: late windup + opponent shield → dash-cancel, then a real shot once the shield is gone', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)   // STRAFE, LOS
    const bc = makeBot(bot, opp, worldWithLOS(opp.id), false, { ...FAST_PERSONALITY, baitSkill: 1 })

    // Simulate the bot's own late windup
    let winding = true
    Object.defineProperty(bot, 'isWindingUp', { get: () => winding, configurable: true })
    Object.defineProperty(bot, 'windupProgress', { get: () => 0.8, configurable: true })
    // dash interrupts the windup
    let dashed = false
    const origDash = bot.dash.bind(bot)
    bot.dash = (dir: THREE.Vector3) => { dashed = true; winding = false; origDash(dir) }
    // opponent raised the shield
    let oppShield = true
    Object.defineProperty(opp, 'shieldActive', { get: () => oppShield, configurable: true })
    // count the real shots
    let realShots = 0
    const origFire = bot.startFiring.bind(bot)
    bot.startFiring = () => { realShots++; origFire() }

    bc.update(0.05)
    expect(dashed).toBe(true)              // dash-cancel of the windup
    expect(realShots).toBe(0)              // shield still active — no real shot

    bc.update(0.05)
    expect(realShots).toBe(0)              // shield still holding

    oppShield = false                       // opponent dropped the shield
    bc.update(0.05)
    expect(realShots).toBe(1)              // punish with a real shot
  })

  it('dash-dodge bait: opponent dashes during windup → dash-cancel too, shot after the dash', () => {
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
    // opponent dodges with a dash (not a shield)
    let oppDashing = true
    Object.defineProperty(opp, 'dashing', { get: () => oppDashing, configurable: true })
    let realShots = 0
    const origFire = bot.startFiring.bind(bot)
    bot.startFiring = () => { realShots++; origFire() }

    bc.update(0.05)
    expect(dashed).toBe(true)              // bait triggered on the dash-dodge
    expect(realShots).toBe(0)              // opponent still mid-dash

    oppDashing = false                      // dash ended
    bc.update(0.05)
    expect(realShots).toBe(1)              // punish with a real shot
  })

  it('SINGULARITY: with pierceWalls the bot sees the opponent through the wall and opens fire', () => {
    const bot = makePlayer(1)
    const opp = makePlayer(0)
    opp.position.set(0, EYE_HEIGHT, -5)
    // Wall between them: a normal ray hits the block (99), the pierce (pierceWalls) sees the opponent.
    const wallWorld: World = {
      raycast: (_o: THREE.Vector3, _d: THREE.Vector3, _ex: number[] = [], pierce = false) => pierce
        ? ({ object: { userData: { entityId: opp.id } }, point: new THREE.Vector3() }) as any
        : ({ object: { userData: { entityId: 99 } }, point: new THREE.Vector3() }) as any,
    } as unknown as World
    const bc = makeBot(bot, opp, wallWorld)

    // Without overheat — the wall blocks, the bot does not fire
    for (let i = 0; i < 40; i++) bc.update(0.1)
    expect(bot.isWindingUp).toBe(false)

    // Overheat: pierceWalls → the bot should "see" through the wall and wind up
    bot.pierceWalls = true
    let started = false
    for (let i = 0; i < 40; i++) { bc.update(0.1); if (bot.isWindingUp) started = true }
    expect(started).toBe(true)
  })

  it('low baitSkill → does not bait (windup is not cancelled)', () => {
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
