import * as THREE from 'three'
import type { Controller } from '../abstractions'
import type { Player } from '../Player'
import { randomArenaPos } from '../../Arena'
import { TARGET_SPEED, BOT_FIRE_INTERVAL, BOT_SHIELD_INTERVAL } from '../../constants'

interface BotOptions { passive?: boolean; fireInterval?: number; shieldInterval?: number }

/** ИИ бота: навигация/прицел/таймеры стрельбы и щита → те же intent-методы Player. */
export class BotController implements Controller {
  private waypoint = randomArenaPos()
  private shootTimer = 0
  private shieldTimer = 0
  private readonly passive: boolean
  private readonly fireInterval: number
  private readonly shieldInterval: number

  private player: Player
  private getTarget: () => THREE.Vector3

  constructor(
    player: Player,
    getTarget: () => THREE.Vector3,
    opts: BotOptions = {},
  ) {
    this.player = player
    this.getTarget = getTarget
    this.passive = opts.passive ?? false
    this.fireInterval = opts.fireInterval ?? BOT_FIRE_INTERVAL
    this.shieldInterval = opts.shieldInterval ?? BOT_SHIELD_INTERVAL
  }

  update(dt: number) {
    if (this.passive) return
    const pos = this.player.position

    this.player.aim(this.getTarget())   // целимся в точку — игрока

    if (!this.player.isWindingUp) {
      const dx = this.waypoint.x - pos.x
      const dz = this.waypoint.z - pos.z
      const dist = Math.hypot(dx, dz)
      if (dist < 0.5) {
        this.waypoint = randomArenaPos()
      } else {
        this.player.moveIntent(
          new THREE.Vector3((dx / dist) * TARGET_SPEED, 0, (dz / dist) * TARGET_SPEED),
          dt,
        )
      }
    }

    this.shieldTimer += dt * 1000
    if (this.shieldTimer >= this.shieldInterval) {
      this.shieldTimer = 0
      this.player.activateShield()
    }

    if (!this.player.isWindingUp) {
      this.shootTimer += dt * 1000
      if (this.shootTimer >= this.fireInterval) {
        this.shootTimer = 0
        this.player.startFiring()
      }
    }
  }
}
