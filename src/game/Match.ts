import * as THREE from 'three'
import { World } from './World'
import { Player } from './Player'
import { Body } from './Body'
import { BeamWeapon } from './BeamWeapon'
import { Shield } from './Shield'
import { HumanController } from './controllers/HumanController'
import type { PointerControls } from './controllers/HumanController'
import { BotController } from './controllers/BotController'
import { RemoteInputController } from './controllers/RemoteInputController'
import type { Controller } from './abstractions'
import type { HUDAction, MatchResult } from '../hooks/useGameHUD'
import type { MatchRole, MatchPhase, MapId } from '../constants'
import { toVec3, fromVec3 } from '../net/protocol'
import type { InputFrame, Snapshot, MatchEvent, RosterEntry, PhaseMsg } from '../net/protocol'
import { MAPS } from './maps'
import type { IMusicEngine } from './audio/types'
import { MatchMusic } from './audio/MatchMusic'
import type { ISfxEngine } from './audio/sfx/types'
import { MatchSfx } from './audio/sfx/MatchSfx'
import {
  BOT_WINDUP, BOT_SHIELD_DURATION, BOT_SHIELD_INTERVAL,
  WINDUP_MOVE_FACTOR, OPPONENT_ID, READY_COUNTDOWN_MS,
  MATCH_TIME_BROADCAST_MS, DEFAULT_MAP_ID,
  AUTOSTEP_MAX_HEIGHT, AUTOSTEP_MIN_WIDTH, KCC_SLOPE_DEG,
} from '../constants'

const _DOWN = new THREE.Vector3(0, -1, 0)   // scratch: луч вниз для нормали поверхности под игроком

interface NetConfig { localId: number; roster: RosterEntry[] }

const END_FREEZE_MS = 200   // «стоп-кадр»: игроки замирают перед показом экрана исхода (overlay сам делает fade-in)

// Минимальные интерфейсы физики Rapier (используемая часть API) — без зависимости от типов @dimforge/rapier.
type XYZ3 = { x: number; y: number; z: number }
interface Kcc {
  setApplyImpulsesToDynamicBodies(v: boolean): void
  setUp(v: XYZ3): void
  setMaxSlopeClimbAngle(rad: number): void
  setMinSlopeSlideAngle(rad: number): void
  enableAutostep(maxHeight: number, minWidth: number, includeDynamic: boolean): void
  computeColliderMovement(collider: unknown, desired: XYZ3): void
  computedMovement(): XYZ3
  computedGrounded(): boolean
}
interface PhysicsWorld {
  createCharacterController(offset: number): Kcc
  removeCharacterController(kcc: Kcc): void
}
interface MatchOptions {
  scene:    THREE.Scene
  camera:   THREE.PerspectiveCamera
  controls: React.RefObject<PointerControls | null>
  keys:     React.MutableRefObject<{ forward: boolean; back: boolean; left: boolean; right: boolean; jump: boolean }>
  dispatch: (a: HUDAction) => void
  role:      MatchRole     // 'host' | 'client'
  netConfig: NetConfig     // ростер из лобби: ровно [host, opponent]
  defaultThirdPerson?: boolean   // стартовый вид локального игрока (локальное предпочтение)
  durationMs?: number      // длительность матча в мс (0 = без таймера для обратной совместимости)
  mapId?: MapId            // карта матча (геометрия + спавны); по умолчанию DEFAULT_MAP_ID
  seedCode?: string        // источник сида музыки (лобби-код); общий у обоих пиров
  musicEngine?: IMusicEngine  // движок музыки (DIP); нет в юнит-тестах → музыка выключена
  sfxEngine?: ISfxEngine      // движок SFX (DIP); нет в юнит-тестах → тишина
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
  private physicsWorld: PhysicsWorld | null = null
  private kcc: Kcc | null = null

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
  private prevCountTick = 0   // последняя сыгранная секунда отсчёта (дедуп count_tick)
  private phaseDirtyFlag = false   // host: фаза/готовность изменились — переслать клиенту
  private prevPhaseSig = ''        // дедуп dispatch SET_MATCH_PHASE
  private leftIds = new Set<number>()   // отключившиеся игроки
  private pendingResult: MatchResult | null = null   // отложенный экран исхода (после END_FREEZE_MS)
  private resultDueAt = 0

  // Музыка матча (опциональна: без сида/движка — тишина, напр. в юнит-тестах)
  private music: MatchMusic | null = null
  private musicStarted = false
  private sfx: MatchSfx | null = null
  private lastRemainingMs = Infinity    // остаток матча (host считает, client получает в 'time') — для аутро музыки
  private lastRemainingAt = 0

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

    // Музыка матча: только если переданы сид и движок (в юнит-тестах их нет → тишина).
    if (o.seedCode && o.musicEngine) this.music = new MatchMusic(o.seedCode, o.musicEngine, () => this.musicRemainingMs())
    if (o.sfxEngine) this.sfx = new MatchSfx(o.sfxEngine)
  }

  // --- построение игроков (ровно двое: локальный + соперник) ---
  private buildPlayers(o: MatchOptions, net: NetConfig) {
    // Стабильный порядок у обоих пиров → одинаковые точки спавна.
    const roster = [...net.roster].sort((a, b) => a.id - b.id)
    const spawns = MAPS[o.mapId ?? DEFAULT_MAP_ID].spawns   // [HOST_ID, OPPONENT_ID]
    let human!: Player
    let humanController!: HumanController
    const controllers: Controller[] = []
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

      // Спавн по слоту карты: HOST_ID → spawns[0], OPPONENT_ID → spawns[1] (соперник напротив, любой kind).
      p.respawnAt(new THREE.Vector3().fromArray(spawns[e.id === OPPONENT_ID ? 1 : 0]))
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
  attachWorld(world: PhysicsWorld, _rapier: unknown) {
    this.physicsWorld = world
    this.kcc = world.createCharacterController(0.01)
    this.kcc.setApplyImpulsesToDynamicBodies(false)
    this.kcc.setUp({ x: 0, y: 1, z: 0 })
    // Autostep даёт капсуле всходить на ступени (≤AUTOSTEP_MAX_HEIGHT) как по лестнице — в т.ч. на блоки 1×1
    // (высота 1.0); углы склона — для наклонных поверхностей/рамп. Препятствия выше ступени не перешагнуть.
    this.kcc.setMaxSlopeClimbAngle((KCC_SLOPE_DEG * Math.PI) / 180)
    this.kcc.setMinSlopeSlideAngle((KCC_SLOPE_DEG * Math.PI) / 180)
    this.kcc.enableAutostep(AUTOSTEP_MAX_HEIGHT, AUTOSTEP_MIN_WIDTH, false)
    // НЕ включаем snapToGround — он гасит прыжок (тянет капсулу обратно к полу).
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
      this.sfxFrameClientSelf()   // свои движения (прыжок/рывок/щит/land/cooldown) — сразу, без сетевой задержки
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
    this.sfxFrameHost()   // движения обоих (grounded/justJumped уже свежие после applyPhysics) + эмит move
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
      const groundNormal = this.groundNormalUnder(p)                  // нормаль под игроком (для склона)
      p.stepJump()                                                    // прыжок/двойной/auto-bhop (held-ввод)
      p.stepVertical(dt * (p.isWindingUp ? WINDUP_MOVE_FACTOR : 1))   // заряд замедляет падение
      p.stepHorizontal(dt, groundNormal)                             // скоростная модель + следование склону
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

  /** Нормаль поверхности под игроком (луч вниз по меш-блокам) — для следования склону без потери скорости.
   *  Пол (noRaycast) и плоский верх дают n≈(0,1,0) → склон не применяется. Не на земле → null. */
  private groundNormalUnder(p: Player): THREE.Vector3 | null {
    if (!p.grounded) return null
    const hit = this.world.raycast(p.position, _DOWN, [p.id])
    return hit?.face ? hit.face.normal : null
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
              window.__debugTargetHitCount = (window.__debugTargetHitCount ?? 0) + 1
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
    // Тик отсчёта (3/2/1) — раз на целую секунду. 2D, считается локально и на host, и на client.
    if (this.phase === 'countdown') {
      const left = Math.ceil((this.countdownEndsAt - Date.now()) / 1000)
      if (left !== this.prevCountTick && left >= 1 && left <= 3) this.sfx?.play2D('count_tick')
      this.prevCountTick = left
    } else {
      this.prevCountTick = 0
    }
    // Отложенный показ экрана исхода: phase='ended' уже заморозил игроков (стоп-кадр); по истечении паузы —
    // диспатч результата (overlay появляется с собственным fade-in). Тикается и на host, и на client.
    if (this.pendingResult && Date.now() >= this.resultDueAt) {
      this.dispatch({ type: 'SET_MATCH_RESULT', result: this.pendingResult })
      this.pendingResult = null
    }
    // Музыка стартует один раз — только после отсчёта, на входе в live (с мягким фейдом).
    // Покрывает все пути перехода в live: host countdown→live, client applyPhase, forceLiveForTest.
    if (this.phase === 'live' && !this.musicStarted) {
      this.musicStarted = true
      void this.music?.start()
    }
  }

  /** Мир-позиция игрока по id (для позиционных SFX). */
  private sfxPos = (id: number): THREE.Vector3 | null => this.byId.get(id)?.position ?? null

  /** host: перекличка движений обоих игроков + эмит дискретных move-событий (прыжок/land) клиенту. */
  private sfxFrameHost() {
    if (!this.sfx) return
    const inputs = this.players.map(p => ({
      id: p.id, obj: p.bodyGroup, pos: p.position,
      shieldActive: p.shieldActive, dashing: p.dashing, grounded: p.grounded, justJumped: p.justJumped,
      dashReady: p.id === this.localId ? p.dashCooldownProgress() >= 1 : null,
      shieldReady: p.id === this.localId ? p.shieldProgress() >= 1 : null,
      windingUp: p.isWindingUp,
      isLocal: p.id === this.localId,
    }))
    const moves = this.sfx.frame(inputs)
    for (const m of moves) this.emit({ t: 'move', id: m.id, kind: m.kind, pos: toVec3(m.pos) })
  }

  /** client: перекличка движений своего игрока (из локальной симуляции — без сетевой задержки). */
  private sfxFrameClientSelf() {
    if (!this.sfx) return
    const me = this.human
    this.sfx.frame([{
      id: me.id, obj: me.bodyGroup, pos: me.position,
      shieldActive: me.shieldActive, dashing: me.dashing, grounded: me.grounded, justJumped: me.justJumped,
      dashReady: me.dashCooldownProgress() >= 1, shieldReady: me.shieldProgress() >= 1,
      windingUp: me.isWindingUp, isLocal: true,
    }])
  }

  /** Остаток матча в мс для музыки (Infinity до старта часов) — по нему MusicDirector решает аутро. */
  private musicRemainingMs(): number {
    if (!Number.isFinite(this.lastRemainingMs)) return Infinity
    return Math.max(0, this.lastRemainingMs - (Date.now() - this.lastRemainingAt))
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
    this.lastRemainingMs = remaining   // для музыкальной секции finale
    this.lastRemainingAt = now
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
    // Заморозить игроков на END_FREEZE_MS (phase='ended' морозит в tickPhase), затем показать экран исхода.
    this.pendingResult = this.computeResult(reason)
    this.resultDueAt = Date.now() + END_FREEZE_MS
    this.music?.fadeOut()   // плавно гасим музыку перед экраном исхода
    this.sfx?.reset()       // гасим луп щита и сбрасываем переходы
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
      this.dispatch({ type: 'SET_PLAYER_SPEED',    value: this.human.speed })
      // Фаза призрака локального игрока: шлём прогресс пока активна и один раз null по завершении.
      const respawn = this.human.isRespawning ? this.human.respawnProgress() : null
      if (respawn !== null || this.prevRespawnActive) {
        this.dispatch({ type: 'SET_RESPAWNING', progress: respawn })
        this.prevRespawnActive = respawn !== null
      }
    }
  }

  // --- network API (вызывает NetSession) ---
  private emit(e: MatchEvent) {
    if (this.role !== 'host') return
    this.pendingEvents.push(e)
    this.sfx?.combat(e, this.sfxPos)   // хост озвучивает боёвку обоих игроков (combat фильтрует по типу)
  }

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
      else {
        p.applyNetState(ps)
        // Щит/рывок соперника — из флагов снапшота по их переходам (прыжок/land приходят событием move).
        this.sfx?.frame([{
          id: ps.id, obj: p.bodyGroup, pos: p.position,
          shieldActive: ps.shieldActive, dashing: ps.dashing, grounded: null, justJumped: false,
          dashReady: null, shieldReady: null, windingUp: ps.windupProgress > 0, isLocal: false,
        }])
      }
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
        this.sfx?.combat(e, this.sfxPos)
        break
      }
      case 'block': {
        if (e.victim === this.localId) this.dispatch({ type: 'SHIELD_BLOCK' })
        else if (e.shooter === this.localId) this.dispatch({ type: 'BOT_SHIELD_HIT' })
        this.sfx?.combat(e, this.sfxPos)
        break
      }
      case 'respawn': {
        this.byId.get(e.id)?.respawnAt(fromVec3(e.pos))
        this.sfx?.combat(e, this.sfxPos)
        break
      }
      case 'move': {
        if (e.id === this.localId) break   // своё движение уже сыграно предсказанием
        this.sfx?.move(e.kind, this.byId.get(e.id)?.position ?? fromVec3(e.pos))
        break
      }
      case 'scores': {
        this.dispatch({ type: 'SET_SCORES', scores: e.scores })
        break
      }
      case 'time': {
        this.lastRemainingMs = e.remainingMs   // для музыкальной секции finale (клиент)
        this.lastRemainingAt = Date.now()
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
    const w = window
    w.__debugCamera = camera
    w.__debugWindup = () => this.human.isWindingUp
    w.__debugTargetHitCount = 0
    const botPos: Record<number, () => { x: number; y: number; z: number }> = {}
    this.bots.forEach((b, i) => {
      botPos[i] = () => ({ x: b.position.x, y: b.position.y, z: b.position.z })
    })
    w.__debugBotPos = botPos
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
    const w = window
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
    this.music?.dispose()
  }
}
