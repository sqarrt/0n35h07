import * as THREE from 'three'
import type { Controller } from '../abstractions'
import type { Player } from '../Player'
import type { World } from '../World'
import type { MeshUserData } from '../../utils/raycast'
import type { BotPersonality } from './botPersonality'
import { rollHit, aimPoint } from './botAim'
import { shouldEvade } from './botTactics'
import { randomArenaPos } from '../maps'
import {
  BOT_MOVE_SPEED, BOT_SHIELD_INTERVAL,
  BOT_CHASE_DIST, BOT_RETREAT_MS, BOT_DODGE_THRESH,
  BOT_EVADE_NEAR, BOT_EVADE_DASH_RATE,
  BOT_BAIT_LATE_PROGRESS, BOT_BAIT_COOLDOWN_MS,
} from '../../constants'

type BotState = 'WANDER' | 'CHASE' | 'STRAFE' | 'RETREAT'

/** ИИ бота: машина состояний (WANDER/CHASE/STRAFE/RETREAT) + реакция на заряд соперника.
 *  Passive = бот не делает ничего. Personality (из botPersonality) — точность, реакция, частота дэша/прыжка. */
export class BotController implements Controller {
  private state: BotState = 'WANDER'
  private waypoint = randomArenaPos()
  private shootTimer      = 0
  private shieldTimer     = 0
  private retreatTimer    = 0
  private strafeDir       = 1        // +1 / -1 — сторона стрейфа
  private strafeFlipTimer = 0
  private dodgeReactionTimer = -1    // -1 = не активен; >=0 = мс до реакции
  private shotIsHit       = false    // решение текущего выстрела: попадание vs near-miss
  private baitCooldownMs  = 0        // анти-зацикливание развода на щит
  private baitTriedThisShot = false  // ролл развода — один раз на заряд (а не каждый кадр)
  private pendingRealShot = false    // после дэш-отмены: выстрелить по-настоящему, когда щит соперника уйдёт
  private lastKnownPos = new THREE.Vector3()

  // Scratch-векторы — не создаём new THREE.Vector3() в горячем пути
  private _toTarget = new THREE.Vector3()
  private _perp     = new THREE.Vector3()
  private _move     = new THREE.Vector3()
  private _aimPt    = new THREE.Vector3()

  private readonly player: Player
  private readonly getOpponent: () => Player
  private readonly world: World
  private readonly passive: boolean
  private readonly personality: BotPersonality

  constructor(
    player: Player,
    getOpponent: () => Player,
    world: World,
    passive: boolean,
    personality: BotPersonality,
  ) {
    this.player = player
    this.getOpponent = getOpponent
    this.world = world
    this.passive = passive
    this.personality = personality
  }

  update(dt: number) {
    if (this.passive) return

    const pos = this.player.position
    const opp = this.getOpponent()
    const oppPos = opp.position

    // Фаза призрака: только блуждание, сброс боевых таймеров
    if (this.player.isRespawning) {
      this.shootTimer = 0
      this.shieldTimer = 0
      this.pendingRealShot = false
      this.player.setJumpInput(false)
      this._wander(pos, dt)
      return
    }

    // LOS: первый хит raycast должен быть самим соперником
    const hasLOS = this._hasLOS(pos, oppPos, opp.id)
    if (hasLOS) this.lastKnownPos.copy(oppPos)

    const dist = pos.distanceTo(oppPos)

    // DODGE-реакция: независимо от основного состояния
    if (hasLOS && opp.windupProgress > BOT_DODGE_THRESH) {
      if (this.dodgeReactionTimer < 0) this.dodgeReactionTimer = this.personality.reactionMs
    } else {
      this.dodgeReactionTimer = -1
    }
    if (this.dodgeReactionTimer >= 0) {
      this.dodgeReactionTimer -= dt * 1000
      if (this.dodgeReactionTimer <= 0) {
        this.dodgeReactionTimer = -1
        this._executeDodge(pos, oppPos)
      }
    }

    // Отменить заряд при потере LOS
    if (!hasLOS && this.player.isWindingUp) this.player.cancelFiring()

    // Основные переходы состояний
    if (this.retreatTimer > 0) {
      this.retreatTimer -= dt * 1000
      this.state = 'RETREAT'
    } else if (!hasLOS) {
      this.state = 'WANDER'
    } else if (dist > BOT_CHASE_DIST) {
      this.state = 'CHASE'
    } else {
      this.state = 'STRAFE'
    }

    // Действия по состоянию
    switch (this.state) {
      case 'WANDER':  this._wander(pos, dt);          break
      case 'CHASE':   this._chase(pos, oppPos, dt);   break
      case 'STRAFE':  this._strafe(pos, oppPos, dt);  break
      case 'RETREAT': this._retreat(pos, oppPos, dt); break
    }

    // Развод на защиту: в позднем СВОЁМ заряде соперник защищается (щит ИЛИ дэш-уворот) →
    // дэш-отмена (заряд прерывается), запоминаем настоящий выстрел. Ролл — один раз на заряд
    // (иначе за многие кадры даже низкий baitSkill почти всегда разводит); кулдаун против зацикливания.
    const oppDefending = opp.shieldActive || opp.dashing
    if (this.baitCooldownMs > 0) this.baitCooldownMs -= dt * 1000
    if (!this.player.isWindingUp) this.baitTriedThisShot = false   // новый заряд → новый ролл
    if (hasLOS && this.player.isWindingUp && oppDefending
        && this.player.windupProgress > BOT_BAIT_LATE_PROGRESS
        && !this.baitTriedThisShot && this.baitCooldownMs <= 0) {
      this.baitTriedThisShot = true
      if (Math.random() < this.personality.baitSkill) {
        this._toTarget.copy(oppPos).sub(pos).setY(0).normalize()
        this._perp.set(-this._toTarget.z, 0, this._toTarget.x).multiplyScalar(this.strafeDir)
        this.player.dash(this._perp)                 // прерывает заряд
        this.baitCooldownMs  = BOT_BAIT_COOLDOWN_MS
        this.pendingRealShot = true
        this.shootTimer = 0
      }
    }

    // Стрельба (CHASE + STRAFE при наличии LOS): решение hit/near-miss принимается на старте заряда
    if (hasLOS && (this.state === 'CHASE' || this.state === 'STRAFE')) {
      // Настоящий выстрел после развода: соперник отзащищался (щит ушёл и дэш закончился) → наказываем
      if (this.pendingRealShot && !oppDefending && !this.player.isWindingUp) {
        this.pendingRealShot = false
        this.shootTimer = 0
        this.shotIsHit = rollHit(this.personality.hitChance)
        this.player.startFiring()
        this.retreatTimer = BOT_RETREAT_MS
      } else {
        this.shootTimer += dt * 1000
        if (!this.player.isWindingUp && this.shootTimer >= this.personality.fireIntervalMs) {
          this.shootTimer = 0
          this.shotIsHit = rollHit(this.personality.hitChance)
          this.player.startFiring()
          this.retreatTimer = BOT_RETREAT_MS
        }
      }
    }

    // Прицел: во время заряда держим зафиксированное решение выстрела (центр vs near-miss);
    // вне заряда — слежение по центру цели. Цель следуем покадрово → near-miss остаётся «впритирку».
    const aimBase = hasLOS ? oppPos : this.lastKnownPos
    if (this.player.isWindingUp) {
      aimPoint(this._aimPt, aimBase, pos, this.shotIsHit, this.personality.grazeMargin)
    } else {
      this._aimPt.copy(aimBase)
    }
    this.player.aim(this._aimPt)
    this.player.setLook(this._toTarget.copy(this._aimPt).sub(pos))

    // EVADE-модификатор: ведём по очкам и под угрозой → распрыжка поверх боевого поведения.
    // Авто-bhop (держим прыжок) + дэши вбок; частота дэшей масштабируется evadeSkill.
    const evading = shouldEvade({
      kills: this.player.kills, oppKills: opp.kills,
      oppWindingUp: opp.isWindingUp, hasLOS, dist, evadeNear: BOT_EVADE_NEAR,
    })
    if (evading) {
      this.player.setJumpInput(true)
      if (Math.random() < this.personality.evadeSkill * BOT_EVADE_DASH_RATE * dt) {
        this._toTarget.copy(oppPos).sub(pos).setY(0).normalize()
        this._perp.set(-this._toTarget.z, 0, this._toTarget.x).multiplyScalar(this.strafeDir)
        this.player.dash(this._perp)
      }
    }

    // Щит (CHASE + STRAFE)
    if (this.state === 'CHASE' || this.state === 'STRAFE') {
      this.shieldTimer += dt * 1000
      if (this.shieldTimer >= BOT_SHIELD_INTERVAL) {
        this.shieldTimer = 0
        this.player.activateShield()
      }
    }
  }

  // --- состояния ---

  private _wander(pos: THREE.Vector3, dt: number) {
    const dx = this.waypoint.x - pos.x
    const dz = this.waypoint.z - pos.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.5) { this.waypoint = randomArenaPos(); return }
    this.player.moveIntent(this._move.set(dx / dist * BOT_MOVE_SPEED, 0, dz / dist * BOT_MOVE_SPEED), dt)
    this.player.setJumpInput(Math.random() < this.personality.jumpiness * dt)
  }

  private _chase(pos: THREE.Vector3, oppPos: THREE.Vector3, dt: number) {
    this._toTarget.copy(oppPos).sub(pos).setY(0)
    const d = this._toTarget.length()
    if (d > 0.1) this.player.moveIntent(this._move.copy(this._toTarget).normalize().multiplyScalar(BOT_MOVE_SPEED), dt)
    if (Math.random() < this.personality.dashRate * dt) this.player.dash(this._toTarget.normalize())
    this.player.setJumpInput(Math.random() < this.personality.jumpiness * dt)
  }

  private _strafe(pos: THREE.Vector3, oppPos: THREE.Vector3, dt: number) {
    this._toTarget.copy(oppPos).sub(pos).setY(0).normalize()
    this._perp.set(-this._toTarget.z, 0, this._toTarget.x).multiplyScalar(this.strafeDir)
    this.player.moveIntent(this._move.copy(this._perp).multiplyScalar(BOT_MOVE_SPEED), dt)
    this.strafeFlipTimer += dt * 1000
    if (this.strafeFlipTimer >= this.personality.strafeFlipMs) {
      this.strafeFlipTimer = 0
      this.strafeDir = -this.strafeDir
    }
    this.player.setJumpInput(Math.random() < this.personality.jumpiness * dt)
  }

  private _retreat(pos: THREE.Vector3, oppPos: THREE.Vector3, dt: number) {
    this._toTarget.copy(pos).sub(oppPos).setY(0)
    const d = this._toTarget.length()
    if (d > 0.1) this.player.moveIntent(this._move.copy(this._toTarget).normalize().multiplyScalar(BOT_MOVE_SPEED), dt)
    this.player.setJumpInput(Math.random() < this.personality.jumpiness * dt)
  }

  // --- вспомогательные ---

  private _hasLOS(from: THREE.Vector3, to: THREE.Vector3, targetId: number): boolean {
    this._toTarget.copy(to).sub(from)
    const dist = this._toTarget.length()
    if (dist < 0.5) return true
    const hit = this.world.raycast(from, this._toTarget.normalize(), [this.player.id])
    return hit !== null && (hit.object.userData as MeshUserData).entityId === targetId
  }

  private _executeDodge(pos: THREE.Vector3, oppPos: THREE.Vector3) {
    this._toTarget.copy(oppPos).sub(pos).setY(0).normalize()
    const side = Math.random() < 0.5 ? 1 : -1
    this._perp.set(-this._toTarget.z * side, 0, this._toTarget.x * side)
    if (Math.random() < this.personality.dodgeSkill) {
      this.player.dash(this._perp)
      this.player.setJumpInput(true)
    } else {
      this.player.setJumpInput(true)
    }
  }
}
