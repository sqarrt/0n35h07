import * as THREE from 'three'
import { World } from './World'
import { Player } from './Player'
import { Body } from './Body'
import { BeamWeapon } from './BeamWeapon'
import { Shield } from './Shield'
import { HumanController } from './controllers/HumanController'
import { BotController } from './controllers/BotController'
import type { Controller } from './abstractions'
import type { HUDAction } from '../hooks/useGameHUD'
import type { BotDifficulty } from '../constants'
import {
  EYE_HEIGHT, BOT_WINDUP, BOT_COLOR_BASE, BOT_SHIELD_DURATION, BOT_SHIELD_INTERVAL,
} from '../constants'

interface MatchOptions {
  scene:    THREE.Scene
  camera:   THREE.PerspectiveCamera
  controls: React.RefObject<any>
  keys:     React.MutableRefObject<{ forward: boolean; back: boolean; left: boolean; right: boolean }>
  dispatch: (a: HUDAction) => void
  botDifficulties: BotDifficulty[]
}

/** Хозяин матча: владеет миром, игроками и контроллерами. Единственное место правил. */
export class Match {
  readonly root = new THREE.Group()
  readonly human: Player
  readonly bots: Player[]
  readonly humanController: HumanController

  private world: World
  private players: Player[]
  private controllers: Controller[]
  private byId = new Map<number, Player>()
  private teamIds = new Map<number, number[]>()
  private dispatch: MatchOptions['dispatch']

  private lastHud = 0
  private prevWindup = false
  private prevShield = false

  constructor(o: MatchOptions) {
    this.dispatch = o.dispatch
    this.world = new World(o.scene)

    this.human = new Player(0, 0, new Body(0, '#4af'),
      new BeamWeapon({ outerColor: '#0ff' }), new Shield(), '#4af')
    this.human.respawnAt(new THREE.Vector3(0, EYE_HEIGHT, 5))
    this.humanController = new HumanController(this.human, o.camera, o.keys, o.controls, this.world)

    this.bots = o.botDifficulties.map((_, i) => {
      const id = i + 1
      const p = new Player(id, 1, new Body(id, BOT_COLOR_BASE),
        new BeamWeapon({ windupDuration: BOT_WINDUP, cooldownDuration: 0, outerColor: '#f44' }),
        new Shield({ duration: BOT_SHIELD_DURATION, cooldown: BOT_SHIELD_INTERVAL - BOT_SHIELD_DURATION }),
        BOT_COLOR_BASE)
      p.respawnAt(this.world.randomSpawn())
      return p
    })
    const botControllers = this.bots.map((b, i) =>
      new BotController(b, () => this.human.position, { passive: o.botDifficulties[i] === 'passive' }))

    this.players = [this.human, ...this.bots]
    this.controllers = [this.humanController, ...botControllers]
    this.players.forEach(p => {
      this.root.add(p.object3d)
      this.byId.set(p.id, p)
      const ids = this.teamIds.get(p.team) ?? []
      ids.push(p.id)
      this.teamIds.set(p.team, ids)
    })
  }

  update(dt: number) {
    this.controllers.forEach(c => c.update(dt))
    this.players.forEach(p => p.update(dt, this.world, this.teamIds.get(p.team) ?? []))
    this.controllers.forEach(c => c.lateUpdate?.(dt))
    this.resolveCombat()
    this.resolveRespawns(dt)
    this.syncHud()
  }

  private resolveCombat() {
    for (const shooter of this.players) {
      if (!shooter.weaponJustFired) continue
      const o = shooter.fireOutcome
      if (o && o.hitEntityId !== null) {
        const victim = this.byId.get(o.hitEntityId)
        if (victim) {
          const res = victim.receiveHit()
          if (res === 'blocked') {
            if (victim === this.human) this.dispatch({ type: 'SHIELD_BLOCK' })
            else if (shooter === this.human) this.dispatch({ type: 'BOT_SHIELD_HIT' })
          } else {
            if (shooter === this.human && victim !== this.human) {
              if (o.hitPoint) shooter.spawnImpact(o.hitPoint)
              ;(window as any).__debugTargetHitCount = ((window as any).__debugTargetHitCount ?? 0) + 1
            }
            if (victim === this.human) this.dispatch({ type: 'PLAYER_HIT' })
          }
        }
      }
      if (shooter === this.human) {
        this.dispatch({ type: 'BEAM_FLASH' })
        this.humanController.shake()
      }
      shooter.clearJustFired()
    }
  }

  private resolveRespawns(dt: number) {
    for (const p of this.players) {
      if (p.alive) continue
      p.respawnTimer -= dt * 1000
      if (p.respawnTimer <= 0) p.respawnAt(this.world.randomSpawn())
    }
  }

  private syncHud() {
    const w = this.human.isWindingUp
    if (w) this.dispatch({ type: 'SET_WINDUP_PROGRESS', value: this.human.windupProgress })
    else if (this.prevWindup) this.dispatch({ type: 'SET_WINDUP_PROGRESS', value: 0 })
    this.prevWindup = w

    const s = this.human.shieldActive
    if (s !== this.prevShield) this.dispatch({ type: 'SET_SHIELD_VISIBLE', value: s })
    this.prevShield = s

    const now = Date.now()
    if (now - this.lastHud > 50) {
      this.lastHud = now
      this.dispatch({ type: 'SET_BEAM_PROGRESS',   value: this.human.beamCooldownProgress() })
      this.dispatch({ type: 'SET_SHIELD_PROGRESS', value: this.human.shieldProgress() })
    }
  }

  installDebug(camera: THREE.Camera) {
    const w = window as any
    w.__debugCamera = camera
    w.__debugWindup = () => this.human.isWindingUp
    w.__debugTargetHitCount = 0
    w.__debugBotPos = {}
    this.bots.forEach((b, i) => {
      w.__debugBotPos[i] = () => ({ x: b.position.x, y: b.position.y, z: b.position.z })
    })
  }

  dispose() {
    const w = window as any
    delete w.__debugCamera
    delete w.__debugWindup
    delete w.__debugTargetHitCount
    delete w.__debugBotPos
    this.players.forEach(p => p.dispose())
  }
}
