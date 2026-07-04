import * as THREE from 'three'
import { World } from './World'
import { Player } from './Player'
import { Body } from './Body'
import { BeamWeapon } from './BeamWeapon'
import { Shield } from './Shield'
import { HumanController } from './controllers/HumanController'
import type { PointerControls } from './controllers/HumanController'
import { BotController } from './controllers/BotController'
import { botPersonality } from './controllers/botPersonality'
import { RemoteInputController } from './controllers/RemoteInputController'
import type { Controller } from './abstractions'
import type { HUDAction, MatchResult } from '../hooks/useGameHUD'
import type { MatchRole, MatchPhase, MapId } from '../constants'
import { toVec3, fromVec3 } from '../net/protocol'
import { gameLog } from '../diag/gameLog'
import { PHASE_WATCHDOG_MS, HEALTH_HEARTBEAT_MS } from '../diag/constants'
import type { InputFrame, Snapshot, MatchEvent, RosterEntry, PhaseMsg, HitClaim } from '../net/protocol'
import { PredictionLog } from '../net/clientReconcile'
import { applyInputMovement } from '../net/input'
import { LagCompHistory } from './LagCompHistory'
import type { RapierRigidBody } from '@react-three/rapier'
import { emptyBodyState } from './Body'
import type { BodyState } from './Body'
import { MAPS } from './maps'
import type { IMusicEngine } from './audio/types'
import { MatchMusic } from './audio/MatchMusic'
import type { ISfxEngine } from './audio/sfx/types'
import { MatchSfx } from './audio/sfx/MatchSfx'
import type { PlayerSfxInput } from './audio/sfx/MatchSfx'
import { streakTier, announceKind, announceSfx } from './streak'
import type { IAchievements } from '../steam/achievements'
import { NoopAchievements } from '../steam/achievements'
import { bountyFrags, breakResetsCooldowns } from './overheat'
import { createWindupFx } from './fx/windup/createWindupFx'
import { createBeamFx } from './fx/beam/createBeamFx'
import { createRespawnFx } from './fx/respawn/createRespawnFx'
import { createDashFx } from './fx/dash/createDashFx'
import { createShieldFx } from './fx/shield/createShieldFx'
import { decodeBallArt } from './ballArt'
import type { DemoRecorder } from './demo/DemoRecorder'
import {
  WINDUP_MOVE_FACTOR, OPPONENT_ID, READY_COUNTDOWN_MS,
  MATCH_TIME_BROADCAST_MS, DEFAULT_MAP_ID,
  AUTOSTEP_MAX_HEIGHT, AUTOSTEP_MIN_WIDTH, KCC_SLOPE_DEG, KCC_OFFSET, AUTOSTEP_LIFT_EPS,
  BALL_RADIUS, FIXED_DT, NET_RECONCILE_SNAP_DIST, AIM_RANGE,
  NET_INPUT_BUFFER_TARGET, NET_CLOCK_SYNC_GAIN, NET_CLOCK_SYNC_MAX_NUDGE, NET_PREDICT_KILL_MS,
} from '../constants'

const _DOWN    = new THREE.Vector3(0, -1, 0)   // scratch: ray down for the surface normal under the player
const _desired = new THREE.Vector3()            // scratch: consumeDesired → KCC (zero-alloc per frame)

// Knockback on player overlap (instead of hard capsule collision, which glitched at walls and complicated networking).
const PLAYER_OVERLAP_DIST     = BALL_RADIUS * 2   // sphere bodies overlap when centers are closer than this (3D)
const PLAYER_OVERLAP_MIN_DIST = 1e-4              // centers almost coincide → push in an arbitrary direction
const _knock = new THREE.Vector3()                // scratch for the knockback direction (3D between centers)

interface NetConfig { localId: number; roster: RosterEntry[] }

const END_FREEZE_MS = 200   // "freeze-frame": players freeze before the outcome screen shows (the overlay does its own fade-in)

// Minimal Rapier physics interfaces (the part of the API we use) — without depending on @dimforge/rapier types.
type XYZ3 = { x: number; y: number; z: number }
interface Kcc {
  setApplyImpulsesToDynamicBodies(v: boolean): void
  setUp(v: XYZ3): void
  setMaxSlopeClimbAngle(rad: number): void
  setMinSlopeSlideAngle(rad: number): void
  enableAutostep(maxHeight: number, minWidth: number, includeDynamic: boolean): void
  computeColliderMovement(
    collider: unknown,
    desired: XYZ3,
    filterFlags?: number,
    filterGroups?: number,
    filterPredicate?: (collider: { handle: number }) => boolean,
  ): void
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
  netConfig: NetConfig     // roster from the room: exactly [host, opponent]
  localReserveColor?: string   // local player's "second" color (their planet ring); the opponent has no second one
  defaultThirdPerson?: boolean   // local player's starting view (local preference)
  durationMs?: number      // match duration in ms (0 = no timer, for backward compatibility)
  mapId?: MapId            // match map (geometry + spawns); defaults to DEFAULT_MAP_ID
  seedCode?: string        // music seed source (room code); shared by both peers
  musicEngine?: IMusicEngine  // music engine (DIP); absent in unit tests → music off
  sfxEngine?: ISfxEngine      // SFX engine (DIP); absent in unit tests → silence
  achievements?: IAchievements   // Steam achievements sink (DIP); absent → no-op (tests / off-Steam)
}

/** Match owner: owns the world, players and controllers. The single place for rules. */
export class Match {
  readonly human: Player              // local player on this peer
  readonly bots: Player[]
  readonly players: Player[]
  readonly humanController: HumanController
  readonly root = new THREE.Group()    // world-space visual: player bodies + beams (outside RigidBody)
  readonly role: MatchRole
  readonly localId: number
  phase: MatchPhase = 'live'           // entry ritual (1v1): ready → countdown → live
  recorder: DemoRecorder | null = null // dev: demo recording (hook in emit + frame capture from the Game loop)

  private world: World
  private singularityActive = false   // SINGULARITY mode: pierce for both + transparent blocks (tracked to toggle)
  private controllers: Controller[]
  private remoteControllers = new Map<number, RemoteInputController>()   // host: player id → its controller
  private remoteAuth = new Map<number, BodyState>()   // host: remote player id → authoritative post-step state AT its ackTick (consistent `restore`)
  private hostBuffered = NET_INPUT_BUFFER_TARGET   // client: how many of our inputs the host has buffered (from snapshots) — drives the clock-sync nudge
  private pendingHitClaim: HitClaim | null = null   // client: our own shot's raycast result, to send to the host (shooter-authoritative)
  private predictedKill: { id: number; until: number } | null = null   // client: an opponent we predicted dead, holding the ghost until the host confirms ('kill') or the grace expires (rejected → revive from snapshots)
  private byId = new Map<number, Player>()
  private dispatch: MatchOptions['dispatch']
  private pendingEvents: MatchEvent[] = []   // host: match events to broadcast

  // Rapier (via RapierBridge)
  private physicsWorld: PhysicsWorld | null = null
  private stepFn: ((dt: number) => void) | null = null   // manual Rapier step (from useRapier, via RapierBridge)
  private kcc: Kcc | null = null
  private kccNoStep: Kcc | null = null   // no autostep — to recompute a frame where autostep lifted but didn't anchor

  private lastHud = 0
  private prevRespawnActive = false   // dedup of SET_RESPAWNING dispatch
  private prevWindup = false
  private prevShield = false
  private scoresDirty = true   // send a zeroed table at the start
  private firstKillDone = false                  // first frag of the match shown (CATALYST once)
  private colorOf = new Map<number, string>()    // id → player color hex (for highlight/banner)

  // Match clock
  private durationMs: number
  private matchEndsAt = 0       // 0 = not in live yet; set lazily on the first live frame
  private lastTimeSentAt = 0
  private ended = false

  // Entry ritual (1v1)
  private readySet = new Set<number>()
  private countdownEndsAt = 0
  private prevCountTick = 0   // last played countdown second (count_tick dedup)
  private loggedPhase = ''    // diag: last phase written to the log (transition + watchdog driver)
  private phaseEnteredAt = 0  // diag: when the current phase began (watchdog)
  private phaseWarned = false // diag: stuck-phase warning already emitted for this phase
  private actorPrev = new Map<number, { shield: boolean; dash: boolean }>()   // diag: last shield/dash state per player (edge detection)
  private lastHealthAt = 0    // diag: last net-health heartbeat timestamp
  private phaseDirtyFlag = false   // host: phase/readiness changed — resend to the client
  private prevPhaseSig = ''        // dedup of SET_MATCH_PHASE dispatch
  private leftIds = new Set<number>()   // disconnected players
  private pendingResult: MatchResult | null = null   // deferred outcome screen (after END_FREEZE_MS)
  private resultDueAt = 0

  // Client prediction (null on host): records (tick → input, BodyState); reconciles by REPLAY against the host authority.
  private predictionLog: PredictionLog | null = null
  private tick = 0   // monotonic sim tick; the client stamps each input + prediction with it (host echoes it as ackTick)
  private history = new Map<number, LagCompHistory>()   // host: per-player hitbox positions by tick (lag compensation)
  private _lagPos = { x: 0, y: 0, z: 0 }                 // scratch for the rewound position

  // Match music (optional: without a seed/engine — silence, e.g. in unit tests)
  private achievements: IAchievements   // Steam achievements sink for the local player (DIP)
  private music: MatchMusic | null = null
  private musicStarted = false
  private sfx: MatchSfx | null = null
  private _sfxInputsBuf: PlayerSfxInput[] = []   // pre-alloc: update fields in place, no new each frame
  private _sfxSelfBuf:   PlayerSfxInput[] = []
  private _snapBuf: Snapshot | null = null        // pre-alloc snapshot: Vec3 fields updated in-place
  private lastRemainingMs = Infinity    // match remainder (host computes, client gets in 'time') — for outro music
  private lastRemainingAt = 0

  constructor(o: MatchOptions) {
    this.dispatch = o.dispatch
    this.world = new World(o.scene)
    this.role = o.role
    this.localId = o.netConfig.localId
    this.predictionLog = o.role === 'client' ? new PredictionLog() : null
    this.durationMs = o.durationMs ?? 0
    this.achievements = o.achievements ?? new NoopAchievements()

    const { human, humanController, controllers, opponentIsBot } = this.buildPlayers(o, o.netConfig)
    this.human = human
    this.humanController = humanController
    this.players = [...this.byId.values()]
    this.bots = opponentIsBot ? this.players.filter(p => p.id === OPPONENT_ID) : []   // for debug hooks
    this.controllers = controllers

    this.players.forEach(p => this.registerPlayer(p))
    // The readiness ritual runs for ALL 1v1 matches (the room guarantees two players). A bot opponent is auto-ready.
    this.phase = 'ready'
    if (opponentIsBot) this.readySet.add(OPPONENT_ID)

    // Match music: only if a seed and engine are provided (absent in unit tests → silence).
    if (o.seedCode && o.musicEngine) this.music = new MatchMusic(o.seedCode, o.musicEngine, () => this.musicRemainingMs())
    if (o.sfxEngine) this.sfx = new MatchSfx(o.sfxEngine)
  }

  // --- building players (exactly two: local + opponent) ---
  private buildPlayers(o: MatchOptions, net: NetConfig) {
    // Stable order on both peers → identical spawn points.
    const roster = [...net.roster].sort((a, b) => a.id - b.id)
    const spawns = MAPS[o.mapId ?? DEFAULT_MAP_ID].spawns   // [HOST_ID, OPPONENT_ID]
    let human!: Player
    let humanController!: HumanController
    const controllers: Controller[] = []
    let opponentIsBot = false

    for (const e of roster) {
      const isBot = e.kind === 'bot'
      if (e.id === OPPONENT_ID && isBot) opponentIsBot = true
      // Planet ring: the local player gets their "second" color (as in the menu); the opponent has no second → its own color.
      const ringColor = e.id === net.localId ? (o.localReserveColor ?? e.color) : e.color
      // Cosmetic styles from the roster; missing field → safe defaults for older clients.
      const windupStyle = e.windupStyle ?? 'classic'
      const respawnStyle = e.respawnStyle ?? 'echo'
      const dashStyle = e.dashStyle ?? 'streak'
      const shieldStyle = e.shieldStyle ?? 'dome'
      const ballArt = decodeBallArt(e.ballArt) ?? undefined   // ball decal (null → none)
      const p = isBot
        ? new Player(e.id, new Body(e.id, e.color, e.ballModel ?? 'smooth', ringColor, ballArt),
            new BeamWeapon({ outerColor: '#f44' }),   // combat profile identical to a human; red beam — "enemy" marker
            new Shield({ shieldFx: createShieldFx(shieldStyle) }),
            e.color, createWindupFx(windupStyle), windupStyle,
            createRespawnFx(respawnStyle, e.color), respawnStyle,
            createDashFx(dashStyle, e.color), dashStyle)
        : new Player(e.id, new Body(e.id, e.color, e.ballModel ?? 'smooth', ringColor, ballArt),
            new BeamWeapon({ outerColor: e.color, beamFx: createBeamFx(windupStyle, e.color) }),
            new Shield({ shieldFx: createShieldFx(shieldStyle) }),
            e.color, createWindupFx(windupStyle), windupStyle,
            createRespawnFx(respawnStyle, e.color), respawnStyle,
            createDashFx(dashStyle, e.color), dashStyle)
      p.name = e.name
      this.colorOf.set(e.id, e.color)

      // Spawn by map slot: HOST_ID → spawns[0], OPPONENT_ID → spawns[1] (opponent across, any kind).
      p.respawnAt(new THREE.Vector3().fromArray(spawns[e.id === OPPONENT_ID ? 1 : 0]))
      this.byId.set(e.id, p)

      if (e.id === net.localId) {
        human = p
        humanController = new HumanController(p, o.camera, o.keys, o.controls, this.world, o.defaultThirdPerson ?? false)
        controllers.push(humanController)
      } else if (this.role === 'host') {
        if (isBot) {
          controllers.push(new BotController(
            p,
            () => this.human,
            this.world,
            e.difficulty === 'passive',
            botPersonality(e.name),
          ))
        } else {
          const rc = new RemoteInputController(p, this.world)
          this.remoteControllers.set(e.id, rc)
          controllers.push(rc)
        }
      }
      // client: opponent — no controller, driven from snapshots
    }
    return { human, humanController, controllers, opponentIsBot }
  }

  private registerPlayer(p: Player) {
    this.root.add(p.bodyGroup, p.weaponObject, p.trailObject, p.respawnFxObject, p.windupFxObject)
    this.byId.set(p.id, p)
  }

  // 1v1: the only "other" is the opponent, so raycast excludes just the shooter itself.
  private excludeIds(p: Player): number[] { return [p.id] }

  // --- Rapier wiring (called from RapierBridge) ---
  attachWorld(world: PhysicsWorld, _rapier: unknown) {
    this.physicsWorld = world
    this.kcc = this.makeKcc(world, KCC_OFFSET, true)
    this.kccNoStep = this.makeKcc(world, KCC_OFFSET, false)   // fallback KCC without autostep (anti-jitter for a false step)
  }

  /** Rapier's manual step fn (from useRapier). The fixed-tick driver calls `step(FIXED_DT)` once per tick. */
  setStep(fn: (dt: number) => void) { this.stepFn = fn }

  /** Advance the physics world by one fixed step (no-op until the world/step is attached, e.g. unit tests). */
  step(dt: number) { this.stepFn?.(dt) }

  /** Create and configure a KCC. offset — capsule↔world gap (numerical stability); autostep — whether to enable auto-step. */
  private makeKcc(world: PhysicsWorld, offset: number, autostep: boolean): Kcc {
    const kcc = world.createCharacterController(offset)
    kcc.setApplyImpulsesToDynamicBodies(false)
    kcc.setUp({ x: 0, y: 1, z: 0 })
    // Autostep lets the capsule climb steps (≤AUTOSTEP_MAX_HEIGHT) as if up stairs — including 1×1 blocks
    // (height 1.0); slope angles — for inclined surfaces/ramps. Obstacles taller than a step can't be stepped over.
    kcc.setMaxSlopeClimbAngle((KCC_SLOPE_DEG * Math.PI) / 180)
    kcc.setMinSlopeSlideAngle((KCC_SLOPE_DEG * Math.PI) / 180)
    if (autostep) kcc.enableAutostep(AUTOSTEP_MAX_HEIGHT, AUTOSTEP_MIN_WIDTH, false)
    // Do NOT enable snapToGround — it kills the jump (pulls the capsule back to the floor).
    return kcc
  }
  detachWorld() {
    this.stepFn = null
    if (this.physicsWorld) {
      if (this.kcc) this.physicsWorld.removeCharacterController(this.kcc)
      if (this.kccNoStep) this.physicsWorld.removeCharacterController(this.kccNoStep)
    }
    this.kcc = null
    this.kccNoStep = null
    this.physicsWorld = null
  }

  update(dt: number) {
    this.tick++   // advance the sim tick (client stamps its input/prediction with it; host echoes applied ticks)
    this.players.forEach(p => p.syncFromBody())
    this.tickPhase()   // readiness/countdown → freeze + HUD
    if (this.phase === 'live') { this.logActorEdges(); this.healthHeartbeat() }   // diag: shield/dash edges + ~2s net-health

    if (this.role === 'client') {
      // Client: simulate only our own (prediction), remotes — from snapshots.
      // OVERHEAT + SINGULARITY (pierce/transparent blocks) BEFORE aiming — otherwise aimPoint lags a frame.
      this.applyComeback()
      this.humanController.update(dt)
      this.players.forEach(p => {
        if (p.id === this.localId) {
          p.update(dt, this.world, this.excludeIds(p))
          // Shooter-authoritative: the client raycasts its OWN beam (already done in p.update). Spawn the impact from
          // it instantly, and CLAIM the result to the host — the host validates loosely and applies the kill, so "what
          // you shot is what you hit" (no lag-comp rewind, no host-advantage). The host's combat for our shot is gone.
          if (p.weaponJustFired && p.fireOutcome) {
            const o = p.fireOutcome
            if (o.hitPoint) p.spawnImpact(o.hitPoint)
            this.pendingHitClaim = { tick: this.tick, hitId: o.hitEntityId, point: o.hitPoint ? toVec3(o.hitPoint) : null, end: toVec3(o.end) }
            gameLog.log('act', 'fire', { side: 'client', id: p.id, hit: o.hitEntityId, tick: this.tick })
            if (o.hitEntityId !== null) { gameLog.log('act', 'claim_send', { hitId: o.hitEntityId, tick: this.tick }); this.predictOpponentDeath(o.hitEntityId) }
          }
          p.clearJustFired()   // combat is computed by the host → we reset the flag ourselves (else the ball stays bloated)
        } else {
          p.updateRemote(dt, this.world)
        }
      })
      this.applyPhysics(dt)
      this.sfxFrameClientSelf()   // our own moves (jump/dash/shield/land/cooldown) — instantly, without network delay
      this.human.tickRespawn(dt)   // tick the ghost phase locally (indication/speed); finale — via the respawn event
      this.syncHud()
      this.humanController.lateUpdate?.(dt)
      return
    }

    // local / host — authority
    this.applyComeback()
    this.controllers.forEach(c => c.update(dt))
    this.players.forEach(p => p.update(dt, this.world, this.excludeIds(p)))
    this.applyPhysics(dt)
    // Capture each remote's authoritative state ONLY on ticks it applied a real client input — that post-step position
    // IS the position at `ackTick`. The snapshot sends it as `restore`, so the client reconciles its prediction at
    // ackTick against the host's position at ackTick (not the host's live, gap-extrapolated-ahead position — which
    // would make the client replay unacked inputs from a position already past them, double-counting → jitter/snap-back).
    this.remoteControllers.forEach((c, id) => { if (c.appliedReal) { const p = this.byId.get(id); if (p) this.remoteAuth.set(id, p.saveBodyState()) } })
    this.resolveCombat()
    this.resolveRespawns(dt)
    this.tickMatchClock(Date.now())
    this.syncHud()
    this.controllers.forEach(c => c.lateUpdate?.(dt))
    this.sfxFrameHost()   // both players' moves (grounded/justJumped already fresh after applyPhysics) + emit move
  }

  /** After each fixed step (driver): snapshot every player's sim position for render interpolation + lag-comp history. */
  captureTick() {
    this.players.forEach(p => {
      p.captureTick()
      if (this.role === 'host') {
        const rb = p.rb
        if (rb) { const t = rb.translation(); this.histFor(p.id).record(this.tick, t.x, t.y, t.z) }
      }
    })
  }

  private histFor(id: number): LagCompHistory {
    let h = this.history.get(id)
    // ~1s window: must cover interp delay + RTT + the beam's windup (the fire's viewTick is captured at press,
    // but the raycast lands ~windup later) — else the rewind clamps to the oldest sample and misses.
    if (!h) { h = new LagCompHistory(64); this.history.set(id, h) }
    return h
  }


  /** Once per RENDER frame (driver): place all visuals + the local camera by interpolation alpha ∈ [0,1). */
  renderInterpolate(alpha: number) {
    this.players.forEach(p => { p.decayRenderError(); p.renderInterpolate(alpha) })   // ease out any post-correction offset
    this.humanController.renderCamera?.(alpha)   // local human only (host + client both have one)
  }

  /** A collider filter that excludes ALL player capsules — movement collides only with the static arena
   *  (no hard player-player collision; overlap is a knockback impulse). Recomputed each call (replay reuses it). */
  private playerIgnore(): (collider: { handle: number }) => boolean {
    const handles = new Set<number>()
    for (const pp of this.players) {
      const c = pp.rb?.collider(0) as { handle: number } | undefined
      if (c) handles.add(c.handle)
    }
    return (collider: { handle: number }) => !handles.has(collider.handle)
  }

  /** One player's KCC movement step (gravity/jump/horizontal/dash/knockback → sweep vs static → commit). The
   *  input intents must already be applied (live: by the controller; replay: by applyInputMovement). DRY: used by
   *  both `applyPhysics` and prediction `replayFrom`. */
  private stepPlayerMovement(p: Player, rb: RapierRigidBody, dt: number, ignorePlayers: (c: { handle: number }) => boolean) {
    const groundNormal = this.groundNormalUnder(p)                  // normal under the player (for slopes)
    p.stepJump()                                                    // jump/double/auto-bhop (held input)
    p.stepVertical(dt * (p.isWindingUp ? WINDUP_MOVE_FACTOR : 1))   // windup slows the fall
    p.stepHorizontal(dt, groundNormal)                             // speed model + slope following
    p.stepDash(dt)                                                  // dash adds to desired
    this.maybeKnockback(p)                                          // knockback impulse on overlap with another player
    p.stepKnockback(dt)                                             // knockback accumulates into desired (KCC won't let it through walls)
    p.consumeDesired(_desired)
    this.kcc!.computeColliderMovement(rb.collider(0), _desired, undefined, undefined, ignorePlayers)
    let c = this.kcc!.computedMovement()
    let grounded = this.kcc!.computedGrounded()
    // Anti-jitter: autostep lifted the capsule but it didn't anchor → false probe; recompute without autostep.
    if (this.kccNoStep && !grounded && c.y - _desired.y > AUTOSTEP_LIFT_EPS) {
      this.kccNoStep.computeColliderMovement(rb.collider(0), _desired, undefined, undefined, ignorePlayers)
      c = this.kccNoStep.computedMovement()
      grounded = this.kccNoStep.computedGrounded()
    }
    const cur = rb.translation()
    rb.setNextKinematicTranslation({ x: cur.x + c.x, y: cur.y + c.y, z: cur.z + c.z })
    p.setGrounded(grounded)
  }

  /** Movement via KinematicCharacterController. Without Rapier (unit tests) — no-op. */
  private applyPhysics(dt: number) {
    if (!this.kcc) return
    const ignorePlayers = this.playerIgnore()
    for (const p of this.players) {
      const rb = p.rb
      if (!rb) continue
      // Client: don't run KCC for remotes — smoothly pull toward the network target.
      if (this.role === 'client' && p.id !== this.localId) {
        if (p.hasNetTarget()) rb.setNextKinematicTranslation(p.nextRemoteTranslation())
        continue
      }
      const t = p.consumeTeleport()
      if (t) { rb.setNextKinematicTranslation(t); p.setGrounded(true); continue }
      // Host: on a network gap (the remote's controller had no real input this tick) HOLD its avatar — don't step it.
      // The authoritative trajectory then equals EXACTLY the client's own input sequence (one step per input), so the
      // client's prediction reconciles with zero error. Extrapolating here would insert a step the client never
      // predicted → host diverges → reconciliation snap-back (the "client jitter"). The remote just lags a hair under
      // packet jitter (its render is interpolated anyway); it never desyncs.
      const rc = this.remoteControllers.get(p.id)
      if (rc && !rc.appliedReal) continue
      this.stepPlayerMovement(p, rb, dt, ignorePlayers)   // intents already applied by the controller this tick
    }
  }

  /** client: restore the local player to the host authority at ackTick, then REPLAY the unacknowledged inputs
   *  (each: re-apply its movement intent → one KCC step → one Rapier step) to rebuild the corrected "now". */
  private replayFrom(authority: BodyState, inputs: InputFrame[]) {
    const p = this.byId.get(this.localId)
    const rb = p?.rb
    if (!p || !rb || !this.kcc) return
    const predX = p.position.x, predY = p.position.y, predZ = p.position.z   // the predicted "now" before correction
    p.restoreBodyState(authority)
    rb.setNextKinematicTranslation({ x: authority.pos[0], y: authority.pos[1], z: authority.pos[2] })
    this.step(FIXED_DT)                                   // push the restored position into Rapier
    const ignorePlayers = this.playerIgnore()
    for (const input of inputs) {
      applyInputMovement(p, input, FIXED_DT)              // re-apply movement intent + look
      p.setJumpInput(input.jump)                          // held jump (auto-bhop/double — Body decides)
      this.stepPlayerMovement(p, rb, FIXED_DT, ignorePlayers)
      this.step(FIXED_DT)
    }
    p.syncFromBody()                                     // pull the corrected position into the cache
    p.commitCorrection(predX, predY, predZ)              // ease the visual predicted→corrected (no pop)
  }

  /** Knockback impulse pushing player `p` away from the opponent when sphere bodies overlap (instead of hard collision).
   *  Direction — the full 3D vector between centers (you can land on top and push upward).
   *  Starts once and plays out its window (like a dash); while in flight — not restarted. */
  private maybeKnockback(p: Player) {
    if (!p.alive || p.knocking) return
    // Lag-comp the overlap for a REMOTE avatar (host's view of a client): measure against the opponent WHERE THE CLIENT
    // SAW IT (rewound to the client's viewTick) — that's the geometry the client predicted its knockback against, so
    // host & client agree and a player collision produces NO reconciliation snap. Live position otherwise.
    const vt = this.role === 'host' ? (this.remoteControllers.get(p.id)?.lastViewTick ?? 0) : 0
    for (const o of this.players) {
      if (o === p || !o.alive) continue
      let ox = o.position.x, oy = o.position.y, oz = o.position.z
      if (vt > 0 && this.histFor(o.id).at(vt, this._lagPos)) { ox = this._lagPos.x; oy = this._lagPos.y; oz = this._lagPos.z }
      const dx = p.position.x - ox
      const dy = p.position.y - oy
      const dz = p.position.z - oz
      const d = Math.hypot(dx, dy, dz)
      if (d >= PLAYER_OVERLAP_DIST) continue                       // spheres don't overlap
      if (d < PLAYER_OVERLAP_MIN_DIST) _knock.set(1, 0, 0)         // centers coincide → arbitrary direction
      else _knock.set(dx, dy, dz)                                  // 3D from the opponent's center to ours
      p.knockback(_knock)   // knockback normalizes the direction itself
      window.__debugKnockCount = (window.__debugKnockCount ?? 0) + 1   // e2e: fact of a knockback event
      return
    }
  }

  /** Surface normal under the player (ray down over mesh blocks) — for slope following without losing speed.
   *  The floor (noRaycast) and a flat top give n≈(0,1,0) → no slope applied. Not grounded → null. */
  private groundNormalUnder(p: Player): THREE.Vector3 | null {
    if (!p.grounded) return null
    const hit = this.world.raycast(p.position, _DOWN, [p.id])
    return hit?.face ? hit.face.normal : null
  }

  private resolveCombat() {
    for (const shooter of this.players) {
      if (!shooter.weaponJustFired) continue
      const o = shooter.fireOutcome
      if (o) { gameLog.log('act', 'fire', { side: 'host', id: shooter.id, hit: o.hitEntityId }); this.emit({ t: 'fired', id: shooter.id, end: toVec3(o.end), hitPoint: o.hitPoint ? toVec3(o.hitPoint) : null, hit: o.hitEntityId }) }
      // Shooter-authoritative: the host resolves its OWN hits here — that means every HOST-SIMULATED shooter (the
      // local player AND any bot), which is everyone EXCEPT a remote client (those are in remoteControllers). A remote
      // client's hit arrives separately as a HitClaim (applyHitClaim) — what the client saw is what it hit, no lag-comp
      // rewind, no host advantage. (The old `shooter.id === localId` check silently dropped every BOT hit.)
      if (o && o.hitEntityId !== null && !this.remoteControllers.has(shooter.id)) {
        const victim = this.byId.get(o.hitEntityId)
        if (victim) this.resolveHit(shooter, victim, o.hitPoint)
      }
      if (shooter === this.human) {
        this.dispatch({ type: 'BEAM_FLASH' })
        this.humanController.shake()
      }
      shooter.clearJustFired()
    }
  }

  /** Apply an authoritative hit — block or kill + scoring + events. Shared by the host's own shot (resolveCombat) and
   *  a client's shooter-authoritative HitClaim (applyHitClaim). */
  private resolveHit(shooter: Player, victim: Player, hitPoint: THREE.Vector3 | null): void {
    if (!victim.alive) return   // don't finish off a dead/deflating victim
    const res = victim.receiveHit()
    if (res === 'blocked') {
      const perfect = victim.perfectBlock      // perfect block → reset cooldowns for the victim
      if (perfect) victim.resetCooldowns()
      gameLog.log('act', 'block', { shooter: shooter.id, victim: victim.id, perfect })
      this.emit({ t: 'block', shooter: shooter.id, victim: victim.id, perfect })
      if (perfect && victim.id === this.localId) this.achievements.onPerfectBlock()
      if (victim === this.human) this.dispatch({ type: 'SHIELD_BLOCK' })
      else if (shooter === this.human) this.dispatch({ type: 'BOT_SHIELD_HIT' })
    } else {
      victim.deaths++
      const broken = victim.streak           // victim's tier BEFORE reset (for bounty/reset)
      victim.streak = 0
      let streak = 0, firstBlood = false
      let bounty = 0, resetCd = false
      if (shooter !== victim) {
        bounty = bountyFrags(broken)
        resetCd = breakResetsCooldowns(broken)
        shooter.kills += bounty               // scored (with bounty)
        shooter.streak++                      // killstreak — per real kill (+1)
        streak = shooter.streak
        if (!this.firstKillDone) { firstBlood = true; this.firstKillDone = true }
        if (resetCd) shooter.resetCooldowns()
      }
      this.scoresDirty = true
      gameLog.log('act', 'kill', { shooter: shooter.id, victim: victim.id, streak, bounty, firstBlood })
      this.emit({ t: 'kill', shooter: shooter.id, victim: victim.id, streak, firstBlood, bounty, resetCd })
      this.announceStreak(shooter.id, victim.id, streak, firstBlood)
      if (shooter === this.human && victim !== this.human) {
        if (hitPoint) shooter.spawnImpact(hitPoint)
        window.__debugTargetHitCount = (window.__debugTargetHitCount ?? 0) + 1
      }
      if (victim === this.human) this.dispatch({ type: 'PLAYER_HIT' })
    }
  }

  /** host: apply a client's shooter-authoritative hit. Loose validation (P2P 1v1 with friends): the victim must be a
   *  real, living opponent within weapon range. The shield is handled naturally by receiveHit → 'blocked'. A rejected
   *  claim is simply dropped — the client's predicted death (if any) self-corrects from the next snapshot. */
  applyHitClaim(shooterId: number, claim: HitClaim): void {
    if (this.role !== 'host' || claim.hitId === null) return
    const shooter = this.byId.get(shooterId)
    const victim = this.byId.get(claim.hitId)
    if (!shooter || !victim || victim === shooter) { gameLog.warn('act', 'claim_drop', { shooter: shooterId, victim: claim.hitId, reason: 'bad_target' }); return }
    if (!victim.alive) { gameLog.warn('act', 'claim_drop', { shooter: shooterId, victim: claim.hitId, reason: 'dead' }); return }
    const point = claim.point ? fromVec3(claim.point) : victim.position
    const dist = shooter.position.distanceTo(point)
    if (dist > AIM_RANGE) { gameLog.warn('act', 'claim_drop', { shooter: shooterId, victim: claim.hitId, reason: 'range', dist }); return }
    gameLog.log('act', 'claim_apply', { shooter: shooterId, victim: claim.hitId, dist })
    this.resolveHit(shooter, victim, point)
  }

  /** client: the pending shooter-authoritative hit to send the host this frame (cleared on read). */
  drainHitClaim(): HitClaim | null { const c = this.pendingHitClaim; this.pendingHitClaim = null; return c }

  /** client: predict the opponent's death on a local hit (instant feedback — no RTT wait for the host's 'kill').
   *  A false positive (the host rejects — out of range, or a shield raised within RTT) self-corrects from the next
   *  snapshot: applyNetState restores alive/respawning. Skip a visibly shielding opponent — the host would block it,
   *  so let it decide (predicting a death through a raised shield would be the wrong call). */
  private predictOpponentDeath(victimId: number) {
    const victim = this.byId.get(victimId)
    if (!victim || !victim.alive) return
    if (victim.netShielding) { gameLog.log('act', 'predict_skip', { victim: victimId, reason: 'shield' }); return }
    victim.applyDeath()
    this.predictedKill = { id: victimId, until: Date.now() + NET_PREDICT_KILL_MS }
    gameLog.log('act', 'predict_death', { victim: victimId })
  }

  /** client: the host rejected our predicted kill (shield block / lost claim) — undo the false local death, hitbox
   *  included, or the opponent stays unhittable to our raycasts for the rest of the match (no claims ever again). */
  private revertPredictedKill(victimId: number, reason: 'block' | 'grace') {
    this.predictedKill = null
    this.byId.get(victimId)?.reviveFromFalsePrediction()
    gameLog.warn('act', 'predict_revert', { victim: victimId, reason })
  }

  // Ghost phase: the player is invulnerable and moves on its own (via controllers+applyPhysics); when the timer
  // expires it materializes IN PLACE where it stopped (not at a random point).
  private resolveRespawns(dt: number) {
    for (const p of this.players) {
      if (!p.isRespawning) continue
      p.respawnTimer -= dt * 1000
      if (p.respawnTimer <= 0) {
        const pos = p.position.clone()
        p.respawnAt(pos)
        this.remoteAuth.delete(p.id)   // body state reset → don't reconcile against the pre-respawn capture; live restore until the next real input
        gameLog.log('act', 'respawn', { side: 'host', id: p.id })
        this.emit({ t: 'respawn', id: p.id, pos: toVec3(pos) })
      }
    }
  }

  // --- entry ritual (readiness + countdown) ---
  /** Diag: ~2s net-health line during live — the input jitter-buffer depth (host: queued client inputs; client: the
   *  host's echoed depth) + peer count. A trend, not an action: reveals snapshot starvation / building input lag. */
  private healthHeartbeat() {
    const now = Date.now()
    if (now - this.lastHealthAt < HEALTH_HEARTBEAT_MS) return
    this.lastHealthAt = now
    const buffered = this.role === 'host'
      ? Math.max(0, ...[...this.remoteControllers.values()].map(c => c.pending))
      : this.hostBuffered
    gameLog.log('health', 'tick', { role: this.role, buffered, peers: this.players.length })
  }

  /** Diag: log shield/dash on→off edges per player (local from the real sim; the client's opponent from snapshot flags). */
  private logActorEdges() {
    for (const p of this.players) {
      const remote = this.role === 'client' && p.id !== this.localId
      const shield = remote ? p.netShielding : p.shieldActive
      const dash = remote ? p.remoteDashing : p.dashing
      const prev = this.actorPrev.get(p.id) ?? { shield: false, dash: false }
      if (shield !== prev.shield) gameLog.log('act', 'shield', { id: p.id, on: shield })
      if (dash && !prev.dash) gameLog.log('act', 'dash', { id: p.id })
      this.actorPrev.set(p.id, { shield, dash })
    }
  }

  private tickPhase() {
    if (this.phase === 'countdown' && Date.now() >= this.countdownEndsAt) {
      this.phase = 'live'
      this.phaseDirtyFlag = true
    }
    // Diag: log every phase transition once (host & client) and warn if a pre-live phase is stuck.
    if (this.phase !== this.loggedPhase) {
      this.loggedPhase = this.phase
      this.phaseEnteredAt = Date.now()
      this.phaseWarned = false
      gameLog.log('phase', this.phase, { role: this.role, ready: [...this.readySet] })
    } else if (this.phase !== 'live' && this.phase !== 'ended' && !this.phaseWarned && Date.now() - this.phaseEnteredAt > PHASE_WATCHDOG_MS) {
      this.phaseWarned = true
      gameLog.warn('phase', 'stuck', { phase: this.phase, ms: Date.now() - this.phaseEnteredAt, ready: [...this.readySet] })
    }
    const frozen = this.phase !== 'live'
    this.players.forEach(p => p.setFrozen(frozen))
    this.syncPhaseHud()
    // Countdown tick (3/2/1) — once per whole second. 2D, computed locally on both host and client.
    if (this.phase === 'countdown') {
      const left = Math.ceil((this.countdownEndsAt - Date.now()) / 1000)
      if (left !== this.prevCountTick && left >= 1 && left <= 3) this.sfx?.play2D('count_tick')
      this.prevCountTick = left
    } else {
      this.prevCountTick = 0
    }
    // Deferred outcome screen: phase='ended' already froze players (freeze-frame); after the pause —
    // dispatch the result (the overlay appears with its own fade-in). Ticked on both host and client.
    if (this.pendingResult && Date.now() >= this.resultDueAt) {
      this.dispatch({ type: 'SET_MATCH_RESULT', result: this.pendingResult })
      this.pendingResult = null
    }
    // First live frame (countdown done): "GO!" + music start. Once; covers all paths into
    // live (host countdown→live, client applyPhase, forceLiveForTest). go — 2D, like count_tick.
    if (this.phase === 'live' && !this.musicStarted) {
      this.musicStarted = true
      this.sfx?.play2D('go')
      void this.music?.start()
    }
  }

  /** World position of a player by id (for positional SFX). */
  private sfxPos = (id: number): THREE.Vector3 | null => this.byId.get(id)?.position ?? null

  /** host: roll call of both players' moves + emit discrete move events (jump/land) to the client. */
  private sfxFrameHost() {
    if (!this.sfx) return
    // Lazy init of the pre-alloc buffer: id/obj/pos/windupStyle are stable, the rest is updated per-frame.
    if (this._sfxInputsBuf.length === 0) {
      this._sfxInputsBuf = this.players.map(p => ({
        id: p.id, obj: p.bodyGroup, pos: p.position,   // pos — a reference to a Vector3 updated in-place
        shieldActive: false, dashing: false, grounded: null, justJumped: false,
        dashReady: null, shieldReady: null, windingUp: false, windupStyle: p.windupStyle,
        isLocal: p.id === this.localId,
      }))
    }
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i]; const inp = this._sfxInputsBuf[i]
      inp.shieldActive = p.shieldActive; inp.dashing = p.dashing
      inp.grounded = p.grounded; inp.justJumped = p.justJumped
      inp.dashReady  = p.id === this.localId ? p.dashCooldownProgress() >= 1 : null
      inp.shieldReady = p.id === this.localId ? p.shieldProgress() >= 1 : null
      inp.windingUp = p.isWindingUp
    }
    const moves = this.sfx.frame(this._sfxInputsBuf)
    for (const m of moves) { gameLog.log('act', 'move', { side: 'host', id: m.id, kind: m.kind }); this.emit({ t: 'move', id: m.id, kind: m.kind, pos: toVec3(m.pos) }) }
  }

  /** client: roll call of our own player's moves (from local sim — without network delay). */
  private sfxFrameClientSelf() {
    if (!this.sfx) return
    const me = this.human
    if (this._sfxSelfBuf.length === 0) {
      this._sfxSelfBuf = [{
        id: me.id, obj: me.bodyGroup, pos: me.position,
        shieldActive: false, dashing: false, grounded: null, justJumped: false,
        dashReady: null, shieldReady: null, windingUp: false, windupStyle: me.windupStyle, isLocal: true,
      }]
    }
    const inp = this._sfxSelfBuf[0]
    inp.shieldActive = me.shieldActive; inp.dashing = me.dashing
    inp.grounded = me.grounded; inp.justJumped = me.justJumped
    inp.dashReady = me.dashCooldownProgress() >= 1; inp.shieldReady = me.shieldProgress() >= 1
    inp.windingUp = me.isWindingUp
    this.sfx.frame(this._sfxSelfBuf)
  }

  /** Match remainder in ms for music (Infinity until the clock starts) — MusicDirector decides the outro by it. */
  private musicRemainingMs(): number {
    if (!Number.isFinite(this.lastRemainingMs)) return Infinity
    return Math.max(0, this.lastRemainingMs - (Date.now() - this.lastRemainingAt))
  }

  /** Timer remainder in ms for demo recording (before the clock starts — full duration). */
  getRemainingMs(): number {
    const r = this.musicRemainingMs()
    return Number.isFinite(r) ? r : this.durationMs
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

  /** host: mark a player ready; when both are ready — start the countdown (a bot opponent is ready from the start). */
  markReady(id: number) {
    if (this.phase !== 'ready' || !this.players.some(p => p.id === id)) return
    this.readySet.add(id)
    this.phaseDirtyFlag = true
    if (this.players.every(p => this.readySet.has(p.id))) {
      this.phase = 'countdown'
      this.countdownEndsAt = Date.now() + READY_COUNTDOWN_MS
    }
  }

  /** Test hook (e2e): straight into the fight with no 3s countdown. Prod flow always goes ready→countdown→live. */
  forceLiveForTest() {
    this.readySet = new Set(this.players.map(p => p.id))
    this.phase = 'live'
    this.phaseDirtyFlag = true
  }

  /** client: apply the phase from the host. */
  applyPhase(p: PhaseMsg) {
    const enteringCountdown = p.phase === 'countdown' && this.phase !== 'countdown'
    this.phase = p.phase
    this.readySet = new Set(p.ready)
    if (enteringCountdown) this.countdownEndsAt = Date.now() + READY_COUNTDOWN_MS
  }

  serializePhase(): PhaseMsg { return { phase: this.phase, ready: [...this.readySet] } }
  phaseDirty() { return this.phaseDirtyFlag }
  clearPhaseDirty() { this.phaseDirtyFlag = false }

  /** A player disconnected: hide their avatar, end the match, notify the remaining one. */
  handlePlayerLeft(id: number) {
    if (this.leftIds.has(id)) return
    this.leftIds.add(id)
    const p = this.byId.get(id)
    if (p) {
      p.bodyGroup.visible = false
      p.weaponObject.visible = false
      p.trailObject.visible = false
      p.windupFxObject.visible = false
      p.respawnFxObject.visible = false
    }
    this.endMatch('disconnect')
  }

  private tickMatchClock(now: number) {
    if (this.phase !== 'live') return
    if (this.durationMs === 0) return   // no timer (backward compatibility)
    if (this.matchEndsAt === 0) this.matchEndsAt = now + this.durationMs
    const remaining = Math.max(0, this.matchEndsAt - now)
    this.lastRemainingMs = remaining   // for the music finale section
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
    gameLog.log('phase', 'match_end', { reason, role: this.role })
    void gameLog.flush()   // make sure the match's tail reaches disk
    this.phase = 'ended'
    this.phaseDirtyFlag = true
    this.syncPhaseHud()
    // Freeze players for END_FREEZE_MS (phase='ended' freezes in tickPhase), then show the outcome screen.
    this.pendingResult = this.computeResult(reason)
    // Steam achievements: win / flawless win (local player). endMatch runs exactly once per peer.
    if (this.pendingResult.outcome === 'win') {
      const myDeaths = this.byId.get(this.localId)?.deaths ?? 0
      this.achievements.onMatchEnd(true, myDeaths === 0)
    }
    this.resultDueAt = Date.now() + END_FREEZE_MS
    this.music?.fadeOut()   // fade the music out before the outcome screen
    this.sfx?.reset()       // kill the shield loop and reset transitions
    this.emit({ t: 'matchEnd', reason })   // emit only on host (guard inside emit)
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
    if (!w && this.prevWindup) this.dispatch({ type: 'SET_WINDUP_PROGRESS', value: 0 })   // end of windup — immediately
    this.prevWindup = w

    const s = this.human.shieldActive
    if (s !== this.prevShield) this.dispatch({ type: 'SET_SHIELD_VISIBLE', value: s })
    this.prevShield = s

    const now = Date.now()
    if (now - this.lastHud > 50) {
      this.lastHud = now
      // Windup progress — throttled (like the rest of the HUD): every frame it forced an App re-render → spike with post-processing.
      if (w) this.dispatch({ type: 'SET_WINDUP_PROGRESS', value: this.human.windupProgress })
      this.dispatch({ type: 'SET_BEAM_PROGRESS',   value: this.human.beamCooldownProgress() })
      this.dispatch({ type: 'SET_SHIELD_PROGRESS', value: this.human.shieldProgress() })
      this.dispatch({ type: 'SET_DASH_PROGRESS',   value: this.human.dashCooldownProgress() })
      this.dispatch({ type: 'SET_PLAYER_SPEED',    value: this.human.speed })
      // Local player's ghost phase: send progress while active and a single null on completion.
      const respawn = this.human.isRespawning ? this.human.respawnProgress() : null
      if (respawn !== null || this.prevRespawnActive) {
        this.dispatch({ type: 'SET_RESPAWNING', progress: respawn })
        this.prevRespawnActive = respawn !== null
      }
    }
  }

  // --- network API (called by NetSession) ---
  private emit(e: MatchEvent) {
    if (this.role !== 'host') return
    this.pendingEvents.push(e)
    this.recorder?.event(e)            // dev: transient FX in the demo (doesn't consume the network queue)
    this.sfx?.combat(e, this.sfxPos)   // host voices both players' combat (combat filters by type)
  }

  /** Highlight the name by streak (shooter), reset for the victim; at a milestone — banner + 2D sound. Called by both host and client. */
  /** Each frame: OVERHEAT by streak for everyone + SINGULARITY mode (pierce for BOTH + transparent blocks),
   *  if ANYONE reached ×5. Called by both host and client (visual/prediction are identical for both). */
  private applyComeback() {
    for (const p of this.players) p.applyOverheat()
    const singularity = this.players.some(p => p.seeThrough)
    for (const p of this.players) p.pierceWalls = singularity
    if (singularity !== this.singularityActive) {
      this.singularityActive = singularity
      this.world.setBlocksTransparent(singularity)
    }
  }

  private announceStreak(shooterId: number, victimId: number, streak: number, firstBlood: boolean) {
    // Steam achievements for the LOCAL player only. Called by both host (resolveCombat) and client
    // (applyEvent) on every kill → exactly one path per peer, no double-counting.
    if (shooterId === this.localId) this.achievements.onKill(streak, firstBlood)
    this.dispatch({ type: 'SET_STREAK', id: shooterId, tier: streakTier(streak), count: streak })
    this.dispatch({ type: 'SET_STREAK', id: victimId, tier: null, count: 0 })
    const kind = announceKind(streak, firstBlood)
    if (!kind) return
    const name = this.byId.get(shooterId)?.name ?? ''
    const color = this.colorOf.get(shooterId) ?? '#4af'
    this.dispatch({ type: 'ANNOUNCE', name, color, kind })
    this.sfx?.play2D(announceSfx(kind))
    window.__debugLastAnnounce = kind                 // for e2e
    ;(window.__debugAnnounces ??= []).push(kind)      // full announce history (first = catalyst)
  }

  /** host: match events over the past frames (to broadcast) + clear. */
  drainEvents(): MatchEvent[] {
    const e = this.pendingEvents
    this.pendingEvents = []
    return e
  }

  /** host: snapshot of all players + the last processed client input. */
  serializeSnapshot(): Snapshot {
    let ackTick = 0, buffered = 0
    this.remoteControllers.forEach(c => { ackTick = Math.max(ackTick, c.ackTick); buffered = Math.max(buffered, c.pending) })
    if (!this._snapBuf) {
      this._snapBuf = {
        ackTick: 0,
        tick: 0,
        buffered: 0,
        players: this.players.map(p => ({
          id: p.id,
          pos: [0, 0, 0] as [number, number, number],
          aimDir: [0, 0, 0] as [number, number, number],
          alive: true, shieldActive: false, dashing: false, windupProgress: 0, respawning: false,
          restore: emptyBodyState(),   // overwritten by fillState
        })),
      }
    }
    this._snapBuf.ackTick = ackTick
    this._snapBuf.buffered = buffered
    this._snapBuf.tick = this.tick   // the host's current sim tick (client tags its rendered host-tick for lag-comp)
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i]
      p.fillState(this._snapBuf.players[i])
      // For a remote player, send its state AT ackTick (not the live one) so the client's reconcile pair is consistent.
      const auth = this.remoteAuth.get(p.id)
      if (auth) this._snapBuf.players[i].restore = auth
    }
    return this._snapBuf
  }

  /** host: apply the received input frame to player playerId's avatar. */
  pushRemoteInput(playerId: number, frame: InputFrame) {
    this.remoteControllers.get(playerId)?.enqueue(frame)
  }

  /** client: input frame for our own player to send to the host (stamped with the current sim tick). The
   *  post-step BodyState this tick is recorded under that tick, so a later snapshot (ackTick) can be replayed
   *  against our own prediction. */
  localInputFrame(): InputFrame {
    const frame = this.humanController.currentInputFrame(this.tick)
    const me = this.byId.get(this.localId)
    if (me) this.predictionLog?.record(this.tick, frame, me.saveBodyState())
    // Lag-comp: stamp the host-tick we're CURRENTLY rendering the opponent at — EVERY frame, not just on fire. The
    // beam has a windup, so it raycasts several ticks AFTER the press; the host rewinds the victim to the viewTick of
    // the frame applied at FIRE-time (the latest), which tracks the opponent's render through the windup. Stamping
    // only at press would rewind to where the target was when you clicked, missing it after it moved during windup.
    const opp = this.players.find(p => p.id !== this.localId)
    if (opp) frame.viewTick = opp.renderHostTick()
    return frame
  }

  /** client: per-frame tick-rate nudge (seconds) added to the sim accumulator, holding the host's input buffer near
   *  target. Buffer below target → host starving (gaps) → run a touch faster; above → too much input lag → slower.
   *  Gentle gain + a tight clamp keep the clock stable; 0 on the host (it predicts nobody). */
  clockNudge(): number {
    if (this.role !== 'client') return 0
    const n = (NET_INPUT_BUFFER_TARGET - this.hostBuffered) * FIXED_DT * NET_CLOCK_SYNC_GAIN
    return Math.max(-NET_CLOCK_SYNC_MAX_NUDGE, Math.min(NET_CLOCK_SYNC_MAX_NUDGE, n))
  }

  /** client: snapshot → remotes interpolate to the target; our own player reconciles by prediction REPLAY (ackTick). */
  applySnapshot(snap: Snapshot) {
    this.hostBuffered = snap.buffered
    for (const ps of snap.players) {
      const p = this.byId.get(ps.id)
      if (!p) continue
      if (ps.id === this.localId) {
        // Our own player: trust local prediction; on divergence past the deadzone, restore + replay (no snap).
        const d = this.predictionLog?.decide(snap.ackTick, ps.restore, NET_RECONCILE_SNAP_DIST)
        if (d?.kind === 'replay') this.replayFrom(d.from, d.inputs)
      } else {
        // Kill prediction: while a predicted death is latched, ignore snapshots that still show the opponent alive
        // (sent before the host processed our claim) so the ghost doesn't flicker. The host's 'kill' clears the latch
        // (then snapshots drive the real death); if the grace expires with no kill, the host rejected → let it revive.
        const pk = this.predictedKill
        let state = ps
        if (pk && pk.id === ps.id && ps.alive) {
          if (Date.now() < pk.until) state = { ...ps, alive: false, respawning: true }
          else this.revertPredictedKill(ps.id, 'grace')   // grace expired, host rejected → revive
        } else if (pk && pk.id === ps.id && !ps.alive) {
          this.predictedKill = null   // host confirmed the death — snapshots own it now
        }
        p.applyNetState(state, snap.tick)
        // Opponent's shield/dash — from snapshot flags by their transitions (jump/land arrive via a move event).
        this.sfx?.frame([{
          id: ps.id, obj: p.bodyGroup, pos: p.position,
          shieldActive: ps.shieldActive, dashing: ps.dashing, grounded: null, justJumped: false,
          dashReady: null, shieldReady: null, windingUp: ps.windupProgress > 0, windupStyle: p.windupStyle, isLocal: false,
        }])
      }
    }
  }

  /** client: apply a match event from the host. */
  applyEvent(e: MatchEvent) {
    switch (e.t) {
      case 'fired': {
        if (e.id === this.localId) break   // our own shot is already shown by prediction
        // Don't spawn hit sparks on the local player's FP camera (we were hit, the body is hidden).
        const hideImpact = e.hit === this.localId && !this.human.bodyIsVisible
        const hp = e.hitPoint && !hideImpact ? fromVec3(e.hitPoint) : null
        this.byId.get(e.id)?.cosmeticFire(fromVec3(e.end), hp)
        break
      }
      case 'kill': {
        const victim = this.byId.get(e.victim)
        const shooter = this.byId.get(e.shooter)
        if (!victim) break
        if (this.predictedKill?.id === e.victim) { this.predictedKill = null; gameLog.log('act', 'predict_confirm', { victim: e.victim }) }   // confirmed — release the prediction latch
        gameLog.log('act', 'kill', { side: 'client', shooter: e.shooter, victim: e.victim, streak: e.streak })
        victim.applyDeath()
        victim.deaths++
        victim.streak = 0
        if (shooter && shooter !== victim) {
          shooter.kills += e.bounty
          shooter.streak = e.streak
          if (e.resetCd) shooter.resetCooldowns()
        }
        if (victim.id === this.localId) this.dispatch({ type: 'PLAYER_HIT' })
        this.sfx?.combat(e, this.sfxPos)
        this.announceStreak(e.shooter, e.victim, e.streak, e.firstBlood)
        break
      }
      case 'block': {
        gameLog.log('act', 'block', { side: 'client', shooter: e.shooter, victim: e.victim, perfect: e.perfect })
        // Our claim was rejected by the victim's shield — the predicted death was false; revive NOW, not on grace expiry.
        if (this.predictedKill?.id === e.victim) this.revertPredictedKill(e.victim, 'block')
        if (e.perfect) this.byId.get(e.victim)?.resetCooldowns()   // mirror the cooldown reset from the host
        if (e.perfect && e.victim === this.localId) this.achievements.onPerfectBlock()
        if (e.victim === this.localId) this.dispatch({ type: 'SHIELD_BLOCK' })
        else if (e.shooter === this.localId) this.dispatch({ type: 'BOT_SHIELD_HIT' })
        this.sfx?.combat(e, this.sfxPos)
        break
      }
      case 'respawn': {
        gameLog.log('act', 'respawn', { side: 'client', id: e.id })
        this.byId.get(e.id)?.respawnAt(fromVec3(e.pos))
        if (e.id === this.localId) this.predictionLog?.reset()   // teleport invalidates predictions
        this.sfx?.combat(e, this.sfxPos)
        break
      }
      case 'move': {
        if (e.id === this.localId) break   // our own movement is already played by prediction
        gameLog.log('act', 'move', { side: 'client', id: e.id, kind: e.kind })
        this.sfx?.move(e.kind, this.byId.get(e.id)?.position ?? fromVec3(e.pos))
        break
      }
      case 'scores': {
        this.dispatch({ type: 'SET_SCORES', scores: e.scores })
        break
      }
      case 'time': {
        this.lastRemainingMs = e.remainingMs   // for the music finale section (client)
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
    w.__debugKnockCount = 0
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
    w.__debugPlayerSpeed = (id: number) => this.byId.get(id)?.speed ?? null
    // Physics ready = Rapier WASM loaded and the world attached (before that applyPhysics is a no-op, no movement).
    // For e2e: __debugForceLive enters live before physics is ready (in the real flow the readiness ritual
    // and countdown hide that) — movement tests must wait for this flag, not just the phase.
    w.__debugPhysicsReady = () => this.physicsWorld != null
  }

  dispose() {
    const w = window
    delete w.__debugCamera
    delete w.__debugWindup
    delete w.__debugTargetHitCount
    delete w.__debugKnockCount
    delete w.__debugBotPos
    delete w.__debugRole
    delete w.__debugPlayerPos
    delete w.__debugScore
    delete w.__debugBodyScale
    delete w.__debugForceEnd
    delete w.__debugPlayerSpeed
    delete w.__debugPhysicsReady
    if (this.singularityActive) this.world.setBlocksTransparent(false)   // restore blocks to opaque
    this.players.forEach(p => p.dispose())
    this.music?.dispose()
  }
}
