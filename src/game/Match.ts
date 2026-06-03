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
import type { HUDAction, MatchResult } from '../hooks/useGameHUD'
import type { MatchRole, MatchPhase } from '../constants'
import { toVec3, fromVec3 } from '../net/protocol'
import type { InputFrame, Snapshot, MatchEvent, RosterEntry, PhaseMsg } from '../net/protocol'
import {
  EYE_HEIGHT, BOT_WINDUP, BOT_SHIELD_DURATION, BOT_SHIELD_INTERVAL,
  WINDUP_MOVE_FACTOR, OPPONENT_ID, NET_HUMAN_SPAWN_Z, READY_COUNTDOWN_MS,
  MATCH_TIME_BROADCAST_MS,
} from '../constants'

interface NetConfig { localId: number; roster: RosterEntry[] }
interface MatchOptions {
  scene:    THREE.Scene
  camera:   THREE.PerspectiveCamera
  controls: React.RefObject<any>
  keys:     React.MutableRefObject<{ forward: boolean; back: boolean; left: boolean; right: boolean }>
  dispatch: (a: HUDAction) => void
  role:      MatchRole     // 'host' | 'client'
  netConfig: NetConfig     // ростер из лобби: ровно [host, opponent]
  defaultThirdPerson?: boolean   // стартовый вид локального игрока (локальное предпочтение)
  durationMs?: number      // длительность матча в мс (0 = без таймера для обратной совместимости)
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
  phase: MatchPhase = 'live'           // ритуал входа (1v1): ready → countdown → live

  private world: World
  private controllers: Controller[]
  private remoteControllers = new Map<number, RemoteInputController>()   // host: id игрока → его контроллер
  private byId = new Map<number, Player>()
  private dispatch: MatchOptions['dispatch']
  private pendingEvents: MatchEvent[] = []   // host: события матча на рассылку

  // Rapier (через RapierBridge)
  private physicsWorld: any = null
  private kcc: any = null

  private lastHud = 0
  private prevRespawnActive = false   // дедуп диспатча SET_RESPAWNING
  private prevWindup = false
  private prevShield = false
  private scoresDirty = true   // на старте отправить нулевую таблицу

  // Часы матча
  private durationMs: number
  private matchEndsAt = 0       // 0 = ещё не в live; ставится лениво на первом live-кадре
  private lastTimeSentAt = 0
  private ended = false

  // Ритуал входа (1v1)
  private readySet = new Set<number>()
  private countdownEndsAt = 0
  private phaseDirtyFlag = false   // host: фаза/готовность изменились — переслать клиенту
  private prevPhaseSig = ''        // дедуп dispatch SET_MATCH_PHASE
  private leftIds = new Set<number>()   // отключившиеся игроки

  constructor(o: MatchOptions) {
    this.dispatch = o.dispatch
    this.world = new World(o.scene)
    this.role = o.role
    this.localId = o.netConfig.localId
    this.durationMs = o.durationMs ?? 0

    const { human, humanController, controllers, opponentIsBot } = this.buildPlayers(o, o.netConfig)
    this.human = human
    this.humanController = humanController
    this.players = [...this.byId.values()]
    this.bots = opponentIsBot ? this.players.filter(p => p.id === OPPONENT_ID) : []   // для debug-хуков
    this.controllers = controllers

    this.players.forEach(p => this.registerPlayer(p))
    // Ритуал готовности проходят ВСЕ 1v1-матчи (лобби гарантирует двоих). Бот-соперник авто-готов.
    this.phase = 'ready'
    if (opponentIsBot) this.readySet.add(OPPONENT_ID)
  }

  // --- построение игроков (ровно двое: локальный + соперник) ---
  private buildPlayers(o: MatchOptions, net: NetConfig) {
    // Стабильный порядок у обоих пиров → одинаковые точки спавна.
    const roster = [...net.roster].sort((a, b) => a.id - b.id)
    let human!: Player
    let humanController!: HumanController
    const controllers: Controller[] = []
    let humanIndex = 0
    let opponentIsBot = false

    for (const e of roster) {
      const isBot = e.kind === 'bot'
      if (e.id === OPPONENT_ID && isBot) opponentIsBot = true
      const p = isBot
        ? new Player(e.id, new Body(e.id, e.color, e.ballModel ?? 'smooth'),
            new BeamWeapon({ windupDuration: BOT_WINDUP, cooldownDuration: 0, outerColor: '#f44' }),
            new Shield({ duration: BOT_SHIELD_DURATION, cooldown: BOT_SHIELD_INTERVAL - BOT_SHIELD_DURATION }),
            e.color)
        : new Player(e.id, new Body(e.id, e.color, e.ballModel ?? 'smooth'),
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
        humanController = new HumanController(p, o.camera, o.keys, o.controls, this.world, o.defaultThirdPerson ?? false)
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
      // client: соперник — без контроллера, ведём из снапшотов
    }
    return { human, humanController, controllers, opponentIsBot }
  }

  private registerPlayer(p: Player) {
    this.root.add(p.bodyGroup, p.weaponObject, p.trailObject, p.burstObject)
    this.byId.set(p.id, p)
  }

  // 1v1: единственный «чужой» — соперник, поэтому raycast исключает только самого стрелка.
  private excludeIds(p: Player): number[] { return [p.id] }

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
    this.tickPhase()   // готовность/отсчёт → заморозка + HUD

    if (this.role === 'client') {
      // Клиент: симулируем только своего (предсказание), удалённых — из снапшотов.
      this.humanController.update(dt)
      this.players.forEach(p => {
        if (p.id === this.localId) {
          p.update(dt, this.world, this.excludeIds(p))
          p.clearJustFired()   // боёвку считает хост → сбрасываем флаг сами (иначе шар застрянет раздутым)
        } else {
          p.updateRemote(dt, this.world)
        }
      })
      this.applyPhysics(dt)
      this.human.tickRespawn(dt)   // локально тикаем фазу призрака (индикация/скорость); финал — событием respawn
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
    this.tickMatchClock(Date.now())
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
      const next = { x: cur.x + c.x, y: cur.y + c.y, z: cur.z + c.z }
      if (this.role === 'client') p.reconcileLocal(next)   // свой игрок: тянем к авторитету (анти-дрейф)
      rb.setNextKinematicTranslation(next)
      p.setGrounded(this.kcc.computedGrounded())
    }
  }

  private resolveCombat() {
    for (const shooter of this.players) {
      if (!shooter.weaponJustFired) continue
      const o = shooter.fireOutcome
      if (o) this.emit({ t: 'fired', id: shooter.id, end: toVec3(o.end), hitPoint: o.hitPoint ? toVec3(o.hitPoint) : null, hit: o.hitEntityId })
      if (o && o.hitEntityId !== null) {
        const victim = this.byId.get(o.hitEntityId)
        if (victim && victim.alive) {   // мёртвую/сдувающуюся жертву не добиваем
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

  // Фаза призрака: игрок неуязвим и сам двигается (через controllers+applyPhysics); по истечении таймера
  // материализуется НА МЕСТЕ остановки (не на случайной точке).
  private resolveRespawns(dt: number) {
    for (const p of this.players) {
      if (!p.isRespawning) continue
      p.respawnTimer -= dt * 1000
      if (p.respawnTimer <= 0) {
        const pos = p.position.clone()
        p.respawnAt(pos)
        this.emit({ t: 'respawn', id: p.id, pos: toVec3(pos) })
      }
    }
  }

  // --- ритуал входа (готовность + отсчёт) ---
  private tickPhase() {
    if (this.phase === 'countdown' && Date.now() >= this.countdownEndsAt) {
      this.phase = 'live'
      this.phaseDirtyFlag = true
    }
    const frozen = this.phase !== 'live'
    this.players.forEach(p => p.setFrozen(frozen))
    this.syncPhaseHud()
  }

  private syncPhaseHud() {
    const countdown = this.phase === 'countdown'
      ? Math.max(0, Math.ceil((this.countdownEndsAt - Date.now()) / 1000))
      : 0
    const ready = [...this.readySet].sort((a, b) => a - b)
    const sig = `${this.phase}|${ready.join(',')}|${countdown}`
    if (sig === this.prevPhaseSig) return
    this.prevPhaseSig = sig
    this.dispatch({ type: 'SET_MATCH_PHASE', phase: this.phase, ready, countdown })
  }

  /** host: отметить игрока готовым; когда готовы оба — старт отсчёта (бот-соперник готов изначально). */
  markReady(id: number) {
    if (this.phase !== 'ready' || !this.players.some(p => p.id === id)) return
    this.readySet.add(id)
    this.phaseDirtyFlag = true
    if (this.players.every(p => this.readySet.has(p.id))) {
      this.phase = 'countdown'
      this.countdownEndsAt = Date.now() + READY_COUNTDOWN_MS
    }
  }

  /** Тест-хук (e2e): мгновенно в бой без 3с отсчёта. Прод-флоу всегда идёт ready→countdown→live. */
  forceLiveForTest() {
    this.readySet = new Set(this.players.map(p => p.id))
    this.phase = 'live'
    this.phaseDirtyFlag = true
  }

  /** client: применить фазу от хоста. */
  applyPhase(p: PhaseMsg) {
    const enteringCountdown = p.phase === 'countdown' && this.phase !== 'countdown'
    this.phase = p.phase
    this.readySet = new Set(p.ready)
    if (enteringCountdown) this.countdownEndsAt = Date.now() + READY_COUNTDOWN_MS
  }

  serializePhase(): PhaseMsg { return { phase: this.phase, ready: [...this.readySet] } }
  phaseDirty() { return this.phaseDirtyFlag }
  clearPhaseDirty() { this.phaseDirtyFlag = false }

  /** Игрок отключился: скрыть его аватар, завершить матч, уведомить оставшегося. */
  handlePlayerLeft(id: number) {
    if (this.leftIds.has(id)) return
    this.leftIds.add(id)
    const p = this.byId.get(id)
    if (p) {
      p.bodyGroup.visible = false
      p.weaponObject.visible = false
      p.trailObject.visible = false
    }
    this.endMatch('disconnect')
  }

  private tickMatchClock(now: number) {
    if (this.phase !== 'live') return
    if (this.durationMs === 0) return   // без таймера (обратная совместимость)
    if (this.matchEndsAt === 0) this.matchEndsAt = now + this.durationMs
    const remaining = Math.max(0, this.matchEndsAt - now)
    if (now - this.lastTimeSentAt >= MATCH_TIME_BROADCAST_MS || remaining === 0) {
      this.lastTimeSentAt = now
      this.dispatch({ type: 'SET_MATCH_TIME', seconds: Math.ceil(remaining / 1000) })
      this.emit({ t: 'time', remainingMs: remaining })
    }
    if (remaining === 0) this.endMatch('time')
  }

  private endMatch(reason: 'time' | 'disconnect') {
    if (this.ended) return
    this.ended = true
    this.phase = 'ended'
    this.phaseDirtyFlag = true
    this.syncPhaseHud()
    this.dispatch({ type: 'SET_MATCH_RESULT', result: this.computeResult(reason) })
    this.emit({ t: 'matchEnd', reason })   // emit только у host (guard внутри emit)
  }

  private computeResult(reason: 'time' | 'disconnect'): MatchResult {
    const me = this.byId.get(this.localId)
    const opp = this.players.find(p => p.id !== this.localId)
    const myKills = me?.kills ?? 0
    const oppKills = opp?.kills ?? 0
    const outcome: 'win' | 'lose' | 'draw' =
      reason === 'disconnect' ? 'win'
      : myKills > oppKills ? 'win'
      : myKills < oppKills ? 'lose'
      : 'draw'
    const scores = this.players.map(p => ({ name: p.name, kills: p.kills, deaths: p.deaths }))
    return { outcome, reason, scores }
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
      // Фаза призрака локального игрока: шлём прогресс пока активна и один раз null по завершении.
      const respawn = this.human.isRespawning ? this.human.respawnProgress() : null
      if (respawn !== null || this.prevRespawnActive) {
        this.dispatch({ type: 'SET_RESPAWNING', progress: respawn })
        this.prevRespawnActive = respawn !== null
      }
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

  /** client: снимок → удалённым позиция/визуал; своему — авторитет для мягкой реконсиляции. */
  applySnapshot(snap: Snapshot) {
    for (const ps of snap.players) {
      const p = this.byId.get(ps.id)
      if (!p) continue
      if (ps.id === this.localId) p.setAuthoritative(fromVec3(ps.pos))   // предсказание + коррекция к авторитету
      else p.applyNetState(ps)
    }
  }

  /** client: применить событие матча от хоста. */
  applyEvent(e: MatchEvent) {
    switch (e.t) {
      case 'fired': {
        if (e.id === this.localId) break   // свой выстрел уже показан предсказанием
        // Искры попадания не спавним на FP-камере локального игрока (попали в нас, тело скрыто).
        const hideImpact = e.hit === this.localId && !this.human.bodyIsVisible
        const hp = e.hitPoint && !hideImpact ? fromVec3(e.hitPoint) : null
        this.byId.get(e.id)?.cosmeticFire(fromVec3(e.end), hp)
        break
      }
      case 'kill': {
        const victim = this.byId.get(e.victim)
        const shooter = this.byId.get(e.shooter)
        if (!victim) break
        victim.applyDeath()
        victim.deaths++
        if (shooter && shooter !== victim) shooter.kills++
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
      case 'time': {
        this.dispatch({ type: 'SET_MATCH_TIME', seconds: Math.ceil(e.remainingMs / 1000) })
        break
      }
      case 'matchEnd': {
        this.endMatch(e.reason)
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
    w.__debugBodyScale = (id: number) => this.byId.get(id)?.bodyScale ?? null
    w.__debugForceEnd = () => this.endMatch('time')
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
    delete w.__debugBodyScale
    delete w.__debugForceEnd
    this.players.forEach(p => p.dispose())
  }
}
