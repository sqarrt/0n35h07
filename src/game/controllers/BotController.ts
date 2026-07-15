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

/** Bot AI: state machine (WANDER/CHASE/STRAFE/RETREAT) + reaction to the opponent's windup.
 *  Passive = bot does nothing. Personality (from botPersonality) — accuracy, reaction, dash/jump rate. */
export class BotController implements Controller {
  private state: BotState = 'WANDER'
  private waypoint = randomArenaPos()
  private shootTimer      = 0
  private shieldTimer     = 0
  private retreatTimer    = 0
  private strafeDir       = 1        // +1 / -1 — strafe side
  private strafeFlipTimer = 0
  private dodgeReactionTimer = -1    // -1 = inactive; >=0 = ms until reaction
  private shotIsHit       = false    // current shot's verdict: hit vs near-miss
  private baitCooldownMs  = 0        // anti-loop for shield baiting
  private baitTriedThisShot = false  // bait roll — once per windup (not every frame)
  private pendingRealShot = false    // after dash-cancel: fire for real once the opponent's shield drops
  private lastKnownPos = new THREE.Vector3()

  // Scratch vectors — avoid allocating new THREE.Vector3() on the hot path
  private _toTarget = new THREE.Vector3()
  private _perp     = new THREE.Vector3()
  private _move     = new THREE.Vector3()
  private _aimPt    = new THREE.Vector3()

  private readonly player: Player
  private readonly getTarget: () => Player | null
  private readonly world: World
  private readonly passive: boolean
  private readonly personality: BotPersonality

  constructor(
    player: Player,
    getTarget: () => Player | null,   // current hostile target (nearest alive enemy); null → nobody to fight
    world: World,
    passive: boolean,
    personality: BotPersonality,
  ) {
    this.player = player
    this.getTarget = getTarget
    this.world = world
    this.passive = passive
    this.personality = personality
  }

  update(dt: number) {
    if (this.passive) return

    const pos = this.player.position
    const opp = this.getTarget()
    if (!opp) {                       // nobody hostile is alive/present — just wander
      this.player.setJumpInput(false)
      this._wander(pos, dt)
      return
    }
    const oppPos = opp.position

    // Ghost phase: wander only, reset combat timers
    if (this.player.isRespawning) {
      this.shootTimer = 0
      this.shieldTimer = 0
      this.pendingRealShot = false
      this.player.setJumpInput(false)
      this._wander(pos, dt)
      return
    }

    // LOS: the first raycast hit must be the opponent itself
    const hasLOS = this._hasLOS(pos, oppPos, opp.id)
    if (hasLOS) this.lastKnownPos.copy(oppPos)

    const dist = pos.distanceTo(oppPos)

    // DODGE reaction: independent of the main state
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

    // Cancel windup on LOS loss
    if (!hasLOS && this.player.isWindingUp) this.player.cancelFiring()

    // Main state transitions
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

    // Per-state actions
    switch (this.state) {
      case 'WANDER':  this._wander(pos, dt);          break
      case 'CHASE':   this._chase(pos, oppPos, dt);   break
      case 'STRAFE':  this._strafe(pos, oppPos, dt);  break
      case 'RETREAT': this._retreat(pos, oppPos, dt); break
    }

    // Defense bait: late in our OWN windup the opponent defends (shield OR dash-dodge) →
    // dash-cancel (windup aborts), remember the real shot. Roll once per windup
    // (otherwise across many frames even low baitSkill almost always baits); cooldown prevents looping.
    const oppDefending = opp.shieldActive || opp.dashing
    if (this.baitCooldownMs > 0) this.baitCooldownMs -= dt * 1000
    if (!this.player.isWindingUp) this.baitTriedThisShot = false   // new windup → new roll
    if (hasLOS && this.player.isWindingUp && oppDefending
        && this.player.windupProgress > BOT_BAIT_LATE_PROGRESS
        && !this.baitTriedThisShot && this.baitCooldownMs <= 0) {
      this.baitTriedThisShot = true
      if (Math.random() < this.personality.baitSkill) {
        this._toTarget.copy(oppPos).sub(pos).setY(0).normalize()
        this._perp.set(-this._toTarget.z, 0, this._toTarget.x).multiplyScalar(this.strafeDir)
        this.player.dash(this._perp)                 // aborts the windup
        this.baitCooldownMs  = BOT_BAIT_COOLDOWN_MS
        this.pendingRealShot = true
        this.shootTimer = 0
      }
    }

    // Firing (CHASE + STRAFE with LOS): hit/near-miss verdict is decided at windup start
    if (hasLOS && (this.state === 'CHASE' || this.state === 'STRAFE')) {
      // Real shot after the bait: opponent finished defending (shield gone and dash over) → punish
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

    // Aim: during windup hold the locked shot verdict (center vs near-miss);
    // outside windup — track the target's center. We follow the target per frame → near-miss stays a graze.
    const aimBase = hasLOS ? oppPos : this.lastKnownPos
    if (this.player.isWindingUp) {
      aimPoint(this._aimPt, aimBase, pos, this.shotIsHit, this.personality.grazeMargin)
    } else {
      this._aimPt.copy(aimBase)
    }
    this.player.aim(this._aimPt)
    this.player.setLook(this._toTarget.copy(this._aimPt).sub(pos))

    // EVADE modifier: leading on score and under threat → bunny-hop on top of combat behavior.
    // Auto-bhop (hold jump) + side dashes; dash rate scales with evadeSkill.
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

    // Shield (CHASE + STRAFE)
    if (this.state === 'CHASE' || this.state === 'STRAFE') {
      this.shieldTimer += dt * 1000
      if (this.shieldTimer >= BOT_SHIELD_INTERVAL) {
        this.shieldTimer = 0
        this.player.activateShield()
      }
    }
  }

  // --- states ---

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

  // --- helpers ---

  private _hasLOS(from: THREE.Vector3, to: THREE.Vector3, targetId: number): boolean {
    this._toTarget.copy(to).sub(from)
    const dist = this._toTarget.length()
    if (dist < 0.5) return true
    // In SINGULARITY mode (overheat) the bot, like a human, shoots through walls — LOS must
    // ignore them too, otherwise the bot "can't see" the opponent through a block and won't fire.
    const hit = this.world.raycast(from, this._toTarget.normalize(), [this.player.id], this.player.pierceWalls)
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
