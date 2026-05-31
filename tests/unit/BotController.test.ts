import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player } from '../../src/game/Player'
import { Body } from '../../src/game/Body'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import { Shield } from '../../src/game/Shield'
import { BotController } from '../../src/game/controllers/BotController'
import { BOT_WINDUP, BOT_SHIELD_DURATION, BOT_SHIELD_INTERVAL, EYE_HEIGHT } from '../../src/constants'

function makeBot(id = 1) {
  const p = new Player(id, 1, new Body(id, '#5af'),
    new BeamWeapon({ windupDuration: BOT_WINDUP, cooldownDuration: 0 }),
    new Shield({ duration: BOT_SHIELD_DURATION, cooldown: BOT_SHIELD_INTERVAL - BOT_SHIELD_DURATION }),
    '#5af')
  p.respawnAt(new THREE.Vector3(0, EYE_HEIGHT, 0))
  return p
}
const target = () => new THREE.Vector3(0, EYE_HEIGHT, -10)

describe('BotController', () => {
  it('passive — не стреляет и не двигается', () => {
    const p = makeBot()
    const bc = new BotController(p, target, { passive: true })
    for (let i = 0; i < 100; i++) bc.update(0.1)   // 10с
    expect(p.isWindingUp).toBe(false)
    expect(p.position.x).toBeCloseTo(0)
    expect(p.position.z).toBeCloseTo(0)
  })

  it('активный — начинает заряд после fireInterval', () => {
    const p = makeBot()
    const bc = new BotController(p, target, { fireInterval: 2500 })
    let started = false
    for (let i = 0; i < 40; i++) { bc.update(0.1); if (p.isWindingUp) started = true }
    expect(started).toBe(true)
  })

  it('активный — поднимает щит после shieldInterval', () => {
    const p = makeBot()
    const bc = new BotController(p, target, { shieldInterval: 5000 })
    let shielded = false
    for (let i = 0; i < 60; i++) { bc.update(0.1); if (p.shieldActive) shielded = true }
    expect(shielded).toBe(true)
  })

  it('активный — копит намерение движения к waypoint', () => {
    const p = makeBot()
    const bc = new BotController(p, target, {})
    for (let i = 0; i < 20; i++) bc.update(0.05)   // 1с, ещё не стреляет
    // Интеграцию позиции делает Rapier KCC; контроллер лишь накапливает desired.
    const d = p.consumeDesired()
    expect(Math.hypot(d.x, d.z)).toBeGreaterThan(0)
  })
})
