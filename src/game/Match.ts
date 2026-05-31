import * as THREE from 'three'
import { World } from './World'
import { Player } from './Player'
import { Body } from './Body'
import { BeamWeapon } from './BeamWeapon'
import { Shield } from './Shield'
import { HumanController } from './controllers/HumanController'
import { BotController } from './controllers/BotController'
import { RemoteInputController } from './controllers/RemoteInputController'
import type { Controller } from './abstractions'
import type { HUDAction } from '../hooks/useGameHUD'
import type { BotDifficulty, MatchRole } from '../constants'
import { toVec3, fromVec3 } from '../net/protocol'
import type { InputFrame, Snapshot, MatchEvent, RosterEntry } from '../net/protocol'
import {
  EYE_HEIGHT, BOT_WINDUP, BOT_COLOR_BASE, BOT_SHIELD_DURATION, BOT_SHIELD_INTERVAL,
  WINDUP_MOVE_FACTOR, BOT_TEAM, NET_HUMAN_SPAWN_Z,
} from '../constants'

interface NetConfig { localId: number; roster: RosterEntry[] }
interface MatchOptions {
  scene:    THREE.Scene
  camera:   THREE.PerspectiveCamera
  controls: React.RefObject<any>
  keys:     React.MutableRefObject<{ forward: boolean; back: boolean; left: boolean; right: boolean }>
  dispatch: (a: HUDAction) => void
  botDifficulties: BotDifficulty[]
  role?:      MatchRole    // 'local' (default) | 'host' | 'client'
  netConfig?: NetConfig    // обязателен для host/client
}

/** Хозяин матча: владеет миром, игроками и контроллерами. Единственное место правил. */
export class Match {
  readonly human: Player              // локальный игрок на этом пире
  readonly bots: Player[]
  readonly players: Player[]
  readonly humanController: HumanController
  readonly root = new THREE.Group()    // world-space визуал: тела игроков + лучи (вне RigidBody)
  readonly role: MatchRole
  readonly localId: number

  private world: World
  private controllers: Controller[]
  private remoteControllers = new Map<number, RemoteInputController>()   // host: id игрока → его контроллер
  private byId = new Map<number, Player>()
  private teamIds = new Map<number, number[]>()
  private dispatch: MatchOptions['dispatch']
  private pendingEvents: MatchEvent[] = []   // host: события матча на рассылку

  // Rapier (через RapierBridge)
  private physicsWorld: any = null
  private kcc: any = null

  private lastHud = 0
  private prevWindup = false
  private prevShield = false
  private scoresDirty = true   // на старте отправить нулевую таблицу
  private killSeq = 0          // монотонный id для ленты убийств

  constructor(o: MatchOptions) {
    this.dispatch = o.dispatch
    this.world = new World(o.scene)
    this.role = o.role ?? 'local'

    if (o.netConfig) {
      this.localId = o.netConfig.localId
      const { human, humanController, controllers } = this.buildNetPlayers(o, o.netConfig)
      this.human = human
      this.humanController = humanController
      this.players = [...this.byId.values()]
      this.bots = this.players.filter(p => p.team === BOT_TEAM)   // боты — для debug-хуков/индикации
      this.controllers = controllers
    } else {
      this.localId = 0
      const { human, humanController, bots, controllers } = this.buildLocalPlayers(o)
      this.human = human
      this.humanController = humanController
      this.bots = bots
      this.players = [human, ...bots]
      this.controllers = controllers
      this.human.name = 'Вы'
      this.bots.forEach((b, i) => { b.name = `Бот ${i + 1}` })
    }

    this.players.forEach(p => this.registerPlayer(p))
  }

  // --- построение игроков ---
  private buildLocalPlayers(o: MatchOptions) {
    const human = new Player(0, 0, new Body(0, '#4af'),
      new BeamWeapon({ outerColor: '#0ff' }), new Shield(), '#4af')
    human.respawnAt(new THREE.Vector3(0, EYE_HEIGHT, NET_HUMAN_SPAWN_Z))
    const humanController = new HumanController(human, o.camera, o.keys, o.controls, this.world)

    const bots = o.botDifficulties.map((_, i) => {
      const id = i + 1
      const p = new Player(id, 1, new Body(id, BOT_COLOR_BASE),
        new BeamWeapon({ windupDuration: BOT_WINDUP, cooldownDuration: 0, outerColor: '#f44' }),
        new Shield({ duration: BOT_SHIELD_DURATION, cooldown: BOT_SHIELD_INTERVAL - BOT_SHIELD_DURATION }),
        BOT_COLOR_BASE)
      p.respawnAt(this.world.randomSpawn())
      return p
    })
    const botControllers = bots.map((b, i) =>
      new BotController(b, () => human.position, { passive: o.botDifficulties[i] === 'passive' }))
    return { human, humanController, bots, controllers: [humanController, ...botControllers] as Controller[] }
  }

  private buildNetPlayers(o: MatchOptions, net: NetConfig) {
    // Стабильный порядок у обоих пиров → одинаковые точки спавна.
    const roster = [...net.roster].sort((a, b) => a.id - b.id)
    let human!: Player
    let humanController!: HumanController
    const controllers: Controller[] = []
    let humanIndex = 0

    for (const e of roster) {
      const isBot = e.kind === 'bot'
      // Люди — каждый своя команда (бьют друг друга и ботов); боты — общая BOT_TEAM (нет бот-в-бота).
      const p = isBot
        ? new Player(e.id, BOT_TEAM, new Body(e.id, e.color),
            new BeamWeapon({ windupDuration: BOT_WINDUP, cooldownDuration: 0, outerColor: '#f44' }),
            new Shield({ duration: BOT_SHIELD_DURATION, cooldown: BOT_SHIELD_INTERVAL - BOT_SHIELD_DURATION }),
            e.color)
        : new Player(e.id, e.id, new Body(e.id, e.color),
            new BeamWeapon({ outerColor: e.color }), new Shield(), e.color)
      p.name = e.name

      if (isBot) {
        // Бот: на хосте — авторитетный случайный спавн; на клиенте — нейтральная точка (поправит снапшот).
        p.respawnAt(this.role === 'host' ? this.world.randomSpawn() : new THREE.Vector3(0, EYE_HEIGHT, 0))
      } else {
        p.respawnAt(new THREE.Vector3(0, EYE_HEIGHT, humanIndex === 0 ? NET_HUMAN_SPAWN_Z : -NET_HUMAN_SPAWN_Z))
        humanIndex++
      }
      this.byId.set(e.id, p)

      if (e.id === net.localId) {
        human = p
        humanController = new HumanController(p, o.camera, o.keys, o.controls, this.world)
        controllers.push(humanController)
      } else if (this.role === 'host') {
        if (isBot) {
          controllers.push(new BotController(p, () => this.human.position, { passive: e.difficulty === 'passive' }))
        } else {
          const rc = new RemoteInputController(p, this.world)
          this.remoteControllers.set(e.id, rc)
          controllers.push(rc)
        }
      }
      // client: все, кроме локального, — без контроллера, ведём из снапшотов
    }
    return { human, humanController, controllers }
  }

  private registerPlayer(p: Player) {
    this.root.add(p.bodyGroup, p.weaponObject, p.trailObject)
    this.byId.set(p.id, p)
    const ids = this.teamIds.get(p.team) ?? []
    ids.push(p.id)
    this.teamIds.set(p.team, ids)
  }

  private excludeIds(p: Player): number[] { return this.teamIds.get(p.team) ?? [] }

  // --- Rapier wiring (вызывается из RapierBridge) ---
  attachWorld(world: any, _rapier: any) {
    this.physicsWorld = world
    this.kcc = world.createCharacterController(0.01)
    this.kcc.setApplyImpulsesToDynamicBodies(false)
    this.kcc.setUp({ x: 0, y: 1, z: 0 })
    // НЕ включаем snapToGround — он гасит прыжок (тянет капсулу обратно к полу).
    // Арена плоская, скольжение по поверхностям не нужно.
  }
  detachWorld() {
    if (this.physicsWorld && this.kcc) this.physicsWorld.removeCharacterController(this.kcc)
    this.kcc = null
    this.physicsWorld = null
  }

  update(dt: number) {
    this.players.forEach(p => p.syncFromBody())

    if (this.role === 'client') {
      // Клиент: симулируем только своего (предсказание), удалённых — из снапшотов.
      this.humanController.update(dt)
      this.players.forEach(p => {
        if (p.id === this.localId) p.update(dt, this.world, this.excludeIds(p))
        else p.updateRemote(dt, this.world)
      })
      this.applyPhysics(dt)
      this.syncHud()
      this.humanController.lateUpdate?.(dt)
      return
    }

    // local / host — авторитет
    this.controllers.forEach(c => c.update(dt))
    this.players.forEach(p => p.update(dt, this.world, this.excludeIds(p)))
    this.applyPhysics(dt)
    this.resolveCombat()
    this.resolveRespawns(dt)
    this.syncHud()
    this.controllers.forEach(c => c.lateUpdate?.(dt))
  }

  /** Движение через KinematicCharacterController. Без Rapier (юнит-тесты) — no-op. */
  private applyPhysics(dt: number) {
    if (!this.kcc) return
    for (const p of this.players) {
      const rb = p.rb
      if (!rb) continue
      // Клиент: удалённых не считаем KCC — плавно тянем к сетевой цели.
      if (this.role === 'client' && p.id !== this.localId) {
        if (p.hasNetTarget()) rb.setNextKinematicTranslation(p.nextRemoteTranslation())
        continue
      }
      const t = p.consumeTeleport()
      if (t) { rb.setNextKinematicTranslation(t); p.setGrounded(true); continue }
      p.stepVertical(dt * (p.isWindingUp ? WINDUP_MOVE_FACTOR : 1))   // заряд замедляет падение
      p.stepDash(dt)                                                  // рывок добавляет к desired
      this.kcc.computeColliderMovement(rb.collider(0), p.consumeDesired())
      const c = this.kcc.computedMovement()
      const cur = rb.translation()
      rb.setNextKinematicTranslation({ x: cur.x + c.x, y: cur.y + c.y, z: cur.z + c.z })
      p.setGrounded(this.kcc.computedGrounded())
    }
  }

  private resolveCombat() {
    for (const shooter of this.players) {
      if (!shooter.weaponJustFired) continue
      const o = shooter.fireOutcome
      if (o) this.emit({ t: 'fired', id: shooter.id, end: toVec3(o.end), hitPoint: o.hitPoint ? toVec3(o.hitPoint) : null })
      if (o && o.hitEntityId !== null) {
        const victim = this.byId.get(o.hitEntityId)
        if (victim) {
          const res = victim.receiveHit()
          if (res === 'blocked') {
            this.emit({ t: 'block', shooter: shooter.id, victim: victim.id })
            if (victim === this.human) this.dispatch({ type: 'SHIELD_BLOCK' })
            else if (shooter === this.human) this.dispatch({ type: 'BOT_SHIELD_HIT' })
          } else {
            victim.deaths++
            if (shooter !== victim) shooter.kills++
            this.scoresDirty = true
            this.emit({ t: 'kill', shooter: shooter.id, victim: victim.id })
            this.dispatch({ type: 'KILL', kill: { id: ++this.killSeq, killer: shooter.name, victim: victim.name } })
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
      if (p.respawnTimer <= 0) {
        const pos = this.world.randomSpawn()
        p.respawnAt(pos)
        this.emit({ t: 'respawn', id: p.id, pos: toVec3(pos) })
      }
    }
  }

  private syncHud() {
    if (this.scoresDirty) {
      this.scoresDirty = false
      const scores = this.players.map(p => ({ name: p.name, kills: p.kills, deaths: p.deaths }))
      this.dispatch({ type: 'SET_SCORES', scores })
      this.emit({ t: 'scores', scores })
    }

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
      this.dispatch({ type: 'SET_DASH_PROGRESS',   value: this.human.dashCooldownProgress() })
    }
  }

  // --- network API (вызывает NetSession) ---
  private emit(e: MatchEvent) { if (this.role === 'host') this.pendingEvents.push(e) }

  /** host: события матча за прошедшие кадры (на рассылку) + очистка. */
  drainEvents(): MatchEvent[] {
    const e = this.pendingEvents
    this.pendingEvents = []
    return e
  }

  /** host: снимок всех игроков + последний обработанный ввод клиента. */
  serializeSnapshot(): Snapshot {
    let ackSeq = 0
    this.remoteControllers.forEach(c => { ackSeq = Math.max(ackSeq, c.ackSeq) })
    return { ackSeq, players: this.players.map(p => p.serializeState()) }
  }

  /** host: применить присланный кадр ввода к аватару игрока playerId. */
  pushRemoteInput(playerId: number, frame: InputFrame) {
    this.remoteControllers.get(playerId)?.enqueue(frame)
  }

  /** client: кадр ввода своего игрока для отправки хосту. */
  localInputFrame(seq: number): InputFrame { return this.humanController.currentInputFrame(seq) }

  /** client: применить снимок к удалённым игрокам (свой — предсказывается локально). */
  applySnapshot(snap: Snapshot) {
    for (const ps of snap.players) {
      if (ps.id === this.localId) continue
      this.byId.get(ps.id)?.applyNetState(ps)
    }
  }

  /** client: применить событие матча от хоста. */
  applyEvent(e: MatchEvent) {
    switch (e.t) {
      case 'fired': {
        if (e.id === this.localId) break   // свой выстрел уже показан предсказанием
        this.byId.get(e.id)?.cosmeticFire(fromVec3(e.end), e.hitPoint ? fromVec3(e.hitPoint) : null)
        break
      }
      case 'kill': {
        const victim = this.byId.get(e.victim)
        const shooter = this.byId.get(e.shooter)
        if (!victim) break
        victim.applyDeath()
        victim.deaths++
        if (shooter && shooter !== victim) shooter.kills++
        this.dispatch({ type: 'KILL', kill: { id: ++this.killSeq, killer: shooter?.name ?? '?', victim: victim.name } })
        if (victim.id === this.localId) this.dispatch({ type: 'PLAYER_HIT' })
        break
      }
      case 'block': {
        if (e.victim === this.localId) this.dispatch({ type: 'SHIELD_BLOCK' })
        else if (e.shooter === this.localId) this.dispatch({ type: 'BOT_SHIELD_HIT' })
        break
      }
      case 'respawn': {
        this.byId.get(e.id)?.respawnAt(fromVec3(e.pos))
        break
      }
      case 'scores': {
        this.dispatch({ type: 'SET_SCORES', scores: e.scores })
        break
      }
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
    w.__debugRole = () => this.role
    w.__debugPlayerPos = (id: number) => {
      const p = this.byId.get(id)
      return p ? { x: p.position.x, y: p.position.y, z: p.position.z } : null
    }
    w.__debugScore = (id: number) => {
      const p = this.byId.get(id)
      return p ? { kills: p.kills, deaths: p.deaths } : null
    }
  }

  dispose() {
    const w = window as any
    delete w.__debugCamera
    delete w.__debugWindup
    delete w.__debugTargetHitCount
    delete w.__debugBotPos
    delete w.__debugRole
    delete w.__debugPlayerPos
    delete w.__debugScore
    this.players.forEach(p => p.dispose())
  }
}
