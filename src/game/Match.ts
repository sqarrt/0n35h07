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
import type { Controller } from './abstractions'
import type { HUDAction, MatchResult, TeamRank } from '../hooks/useGameHUD'
import type { GameMode } from './modes'
import { teamOfSlot } from './modes'
import { spawnPositionsFor } from './spawns'
import { createNameplate } from './fx/nameplate'
import type { Vec3 } from '../net/protocol'
import type { MatchRole, MatchPhase, MapId } from '../constants'
import { toVec3, fromVec3 } from '../net/protocol'
import { gameLog } from '../diag/gameLog'
import { PHASE_WATCHDOG_MS, HEALTH_HEARTBEAT_MS } from '../diag/constants'
import type { Snapshot, MatchEvent, RosterEntry, PhaseMsg, HitClaim } from '../net/protocol'
import type { RapierRigidBody } from '@react-three/rapier'
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
  WINDUP_MOVE_FACTOR, READY_COUNTDOWN_MS,
  MATCH_TIME_BROADCAST_MS, DEFAULT_MAP_ID,
  AUTOSTEP_MAX_HEIGHT, AUTOSTEP_MIN_WIDTH, KCC_SLOPE_DEG, KCC_OFFSET, AUTOSTEP_LIFT_EPS,
  BALL_RADIUS, AIM_RANGE,
  NET_PREDICT_KILL_MS,
  TEAM_COLORS, NAMEPLATE_NEUTRAL_COLOR,
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
  netConfig: NetConfig     // roster from the room (entry.id === seat index)
  mode?: GameMode          // lobby preset (teams/spawn rule); absent → '1v1' (older callers/tests)
  ffaSpawns?: Vec3[]       // FFA start positions from the Start message (creator-generated)
  owners?: Record<number, string>   // player id → owner PeerId; absent → everything is owned locally (bot matches/tests)
  selfPeer?: string        // this peer's transport id (net.selfId); pairs with `owners`
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
  private mode: GameMode              // lobby preset: fixes teams (teamOfSlot) and the spawn rule
  readonly selfPeer: string           // this peer's transport id ('local' when offline/tests)
  readonly ownedIds: Set<number>      // players THIS peer simulates and judges (self + own bots)
  private owners: Map<number, string> // player id → owner PeerId (missing → selfPeer)
  private singularityActive = false   // SINGULARITY mode: pierce for both + transparent blocks (tracked to toggle)
  private controllers: Controller[]
  private pendingClaims: Array<{ to: string; claim: HitClaim }> = []   // mesh: addressed claims for victims other peers own
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

  private tick = 0   // monotonic sim tick (stamped on outgoing snapshots for interpolation ordering)

  // Match music (optional: without a seed/engine — silence, e.g. in unit tests)
  private achievements: IAchievements   // Steam achievements sink for the local player (DIP)
  private music: MatchMusic | null = null
  private musicStarted = false
  private sfx: MatchSfx | null = null
  private _sfxInputsBuf: PlayerSfxInput[] = []   // pre-alloc: update fields in place, no new each frame
  private _snapBuf: Snapshot | null = null        // pre-alloc snapshot: Vec3 fields updated in-place
  private lastRemainingMs = Infinity    // match remainder (host computes, client gets in 'time') — for outro music
  private lastRemainingAt = 0

  constructor(o: MatchOptions) {
    this.dispatch = o.dispatch
    this.world = new World(o.scene)
    this.role = o.role
    this.localId = o.netConfig.localId
    this.mode = o.mode ?? '1v1'
    // Ownership: "every fact has exactly one owner". Absent owners → the local peer owns everyone (bot matches/tests).
    this.selfPeer = o.selfPeer ?? 'local'
    this.owners = new Map(Object.entries(o.owners ?? {}).map(([k, v]) => [Number(k), v]))
    this.ownedIds = new Set(o.netConfig.roster.map(r => r.id).filter(id => (this.owners.get(id) ?? this.selfPeer) === this.selfPeer))
    this.durationMs = o.durationMs ?? 0
    this.achievements = o.achievements ?? new NoopAchievements()

    const { human, humanController, controllers, botIds } = this.buildPlayers(o, o.netConfig)
    this.human = human
    this.humanController = humanController
    this.players = [...this.byId.values()]
    this.bots = this.players.filter(p => botIds.includes(p.id))   // for debug hooks + streak/target logic
    this.controllers = controllers

    this.players.forEach(p => this.registerPlayer(p))
    // The readiness ritual runs for EVERY match (the room guarantees the start gate). Bots are auto-ready.
    this.phase = 'ready'
    for (const id of botIds) this.readySet.add(id)

    // Match music: only if a seed and engine are provided (absent in unit tests → silence).
    if (o.seedCode && o.musicEngine) this.music = new MatchMusic(o.seedCode, o.musicEngine, () => this.musicRemainingMs())
    if (o.sfxEngine) this.sfx = new MatchSfx(o.sfxEngine)
  }

  // --- building players (every occupied seat of the roster) ---
  private buildPlayers(o: MatchOptions, net: NetConfig) {
    // Stable order on both peers → identical spawn points.
    const roster = [...net.roster].sort((a, b) => a.id - b.id)
    const spawnMap = spawnPositionsFor(this.mode, roster.map(r => r.id), MAPS[o.mapId ?? DEFAULT_MAP_ID].spawns, o.ffaSpawns)
    let human!: Player
    let humanController!: HumanController
    const controllers: Controller[] = []
    const botIds: number[] = []

    for (const e of roster) {
      const isBot = e.kind === 'bot'
      if (isBot) botIds.push(e.id)
      // Planet ring: the "second" appearance color ships in the roster for EVERY player; absent (older peer/demo) → own color.
      const ringColor = e.reserveColor ?? e.color
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
      p.team = teamOfSlot(this.mode, e.id)
      this.colorOf.set(e.id, e.color)
      // Name plates: only when friend/foe reading matters (not 1v1) and never over one's own model.
      if (this.mode !== '1v1' && e.id !== net.localId) {
        const bg = this.mode === '2v2' ? TEAM_COLORS[p.team] : NAMEPLATE_NEUTRAL_COLOR
        p.setNameplate(createNameplate(e.name, bg))
      }

      // Start position from the mode's spawn rule (1v1 — the two map points, exactly the pre-modes game).
      p.respawnAt(new THREE.Vector3().fromArray(spawnMap.get(e.id)!))
      this.byId.set(e.id, p)

      if (e.id === net.localId) {
        human = p
        humanController = new HumanController(p, o.camera, o.keys, o.controls, this.world, o.defaultThirdPerson ?? false)
        controllers.push(humanController)
      } else if (isBot && this.ownedIds.has(e.id)) {
        // A bot is simulated ONLY by its owner; other peers render it from the owner's snapshots.
        controllers.push(new BotController(
          p,
          () => this.nearestEnemy(p),
          this.world,
          e.difficulty === 'passive',
          botPersonality(e.name),
        ))
      }
      // remotes have no controller — they are driven from their owner's snapshots
    }
    return { human, humanController, controllers, botIds }
  }

  /** Owner PeerId of a player ('local'/selfPeer when this peer owns it). */
  ownerOf(id: number): string { return this.owners.get(id) ?? this.selfPeer }

  /** Nearest ALIVE enemy of `p` (teammates, the dead and the departed are skipped); null when nobody hostile is up. */
  private nearestEnemy(p: Player): Player | null {
    let best: Player | null = null
    let bestD = Infinity
    for (const o of this.players) {
      if (o === p || o.team === p.team || !o.alive || this.leftIds.has(o.id)) continue
      const d = o.position.distanceTo(p.position)
      if (d < bestD) { bestD = d; best = o }
    }
    return best
  }

  private registerPlayer(p: Player) {
    this.root.add(p.bodyGroup, p.weaponObject, p.trailObject, p.respawnFxObject, p.windupFxObject)
    this.byId.set(p.id, p)
  }

  // Raycast excludes only the shooter itself: teammates DO block the beam (tactics); harm is gated in resolveHit.
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
    this.tick++   // local sim tick (stamps snapshots for interpolation ordering)
    this.players.forEach(p => p.syncFromBody())
    this.tickPhase()   // readiness/countdown → freeze + HUD
    if (this.phase === 'live') { this.logActorEdges(); this.healthHeartbeat() }   // diag: shield/dash edges + ~2s net-health

    // ONE symmetric peer path: this peer simulates the players it OWNS (self + own bots) with full authority;
    // everyone else is rendered from its owner's snapshots and events. No host, no prediction-replay.
    // OVERHEAT + SINGULARITY (pierce/transparent blocks) BEFORE aiming — otherwise aimPoint lags a frame.
    this.applyComeback()
    this.controllers.forEach(c => c.update(dt))   // only owned players have controllers
    this.players.forEach(p => {
      if (this.ownedIds.has(p.id)) p.update(dt, this.world, this.excludeIds(p))
      else p.updateRemote(dt, this.world)
    })
    this.applyPhysics(dt)
    this.resolveCombat()        // owned shooters: fired-event + claim routing (judge locally or address the owner)
    this.resolveRespawns(dt)    // owned victims respawn here; remotes — via their owner's respawn event
    this.tickMatchClock(Date.now())
    this.syncHud()
    this.controllers.forEach(c => c.lateUpdate?.(dt))
    this.sfxFrameOwned()   // owned players' moves (grounded/justJumped fresh after applyPhysics) + emit move
  }

  /** After each fixed step (driver): snapshot every player's sim position for render interpolation. */
  captureTick() {
    this.players.forEach(p => p.captureTick())
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
   *  input intents must already be applied by the controller. */
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
      // Remotes: no KCC — smoothly pull toward their owner's network target (interp buffer).
      if (!this.ownedIds.has(p.id)) {
        if (p.hasNetTarget()) rb.setNextKinematicTranslation(p.nextRemoteTranslation())
        continue
      }
      const t = p.consumeTeleport()
      if (t) { rb.setNextKinematicTranslation(t); p.setGrounded(true); continue }
      this.stepPlayerMovement(p, rb, dt, ignorePlayers)   // intents already applied by the controller this tick
    }
  }

  /** Knockback impulse pushing player `p` away from the opponent when sphere bodies overlap (instead of hard collision).
   *  Direction — the full 3D vector between centers (you can land on top and push upward).
   *  Starts once and plays out its window (like a dash); while in flight — not restarted. */
  private maybeKnockback(p: Player) {
    if (!p.alive || p.knocking) return
    // Mesh: each owner knocks back its OWN players against everyone's LIVE (interpolated) positions —
    // both sides see roughly the same overlap; no rewinds, no shared authority.
    for (const o of this.players) {
      if (o === p || !o.alive) continue
      const ox = o.position.x, oy = o.position.y, oz = o.position.z
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
      if (!this.ownedIds.has(shooter.id)) continue   // remotes' shots arrive as fired-events; their hits — as claims
      if (!shooter.weaponJustFired) continue
      const o = shooter.fireOutcome
      if (o) {
        gameLog.log('act', 'fire', { id: shooter.id, hit: o.hitEntityId })
        this.emit({ t: 'fired', id: shooter.id, end: toVec3(o.end), hitPoint: o.hitPoint ? toVec3(o.hitPoint) : null, hit: o.hitEntityId })
        // Shooter-authoritative: our raycast IS the shot. Victim we own → judged immediately (no network);
        // victim owned elsewhere → an addressed claim to its owner, plus an optimistic local death prediction
        // for the human's own shots (confirmed by the owner's kill, reverted by block/grace).
        if (o.hitEntityId !== null) {
          if (o.hitPoint && shooter === this.human) shooter.spawnImpact(o.hitPoint)
          this.queueOrJudge({ shooter: shooter.id, hitId: o.hitEntityId, point: o.hitPoint ? toVec3(o.hitPoint) : null, end: toVec3(o.end) })
          if (!this.ownedIds.has(o.hitEntityId) && shooter.id === this.localId) this.predictOpponentDeath(o.hitEntityId)
        }
      }
      if (shooter === this.human) {
        this.dispatch({ type: 'BEAM_FLASH' })
        this.humanController.shake()
      }
      shooter.clearJustFired()
    }
  }

  /** Judge an authoritative hit — block or kill. Run by the peer that OWNS the victim (locally simulated shot
   *  or an incoming claim): the verdict is broadcast slim, the numbers are derived by everyone in applyKill/applyBlock. */
  private resolveHit(shooter: Player, victim: Player, hitPoint: THREE.Vector3 | null): void {
    if (shooter !== victim && shooter.team === victim.team) return   // teammate bodies block the beam but take no harm
    if (!victim.alive) return   // don't finish off a dead/deflating victim
    const res = victim.receiveHit()
    if (res === 'blocked') {
      const perfect = victim.perfectBlock
      gameLog.log('act', 'block', { shooter: shooter.id, victim: victim.id, perfect })
      this.emit({ t: 'block', shooter: shooter.id, victim: victim.id, perfect })
      this.applyBlock(shooter.id, victim.id, perfect)
    } else {
      gameLog.log('act', 'kill', { shooter: shooter.id, victim: victim.id })
      this.emit({ t: 'kill', shooter: shooter.id, victim: victim.id })
      this.applyKill(shooter.id, victim.id)
      void hitPoint   // impact FX is spawned at fire time by the shooter (resolveCombat)
    }
  }

  /** Canonical kill application — IDENTICAL on every peer. Score, streak, bounty, firstBlood, SINGULARITY input —
   *  all DERIVED locally from the slim (shooter, victim) stream, so peers converge without shipping numbers. */
  private applyKill(shooterId: number, victimId: number): void {
    const victim = this.byId.get(victimId)
    const shooter = this.byId.get(shooterId)
    if (!victim) return
    if (this.predictedKill?.id === victimId) { this.predictedKill = null; gameLog.log('act', 'predict_confirm', { victim: victimId }) }
    if (victim.alive) victim.applyDeath()   // the victim's owner already died via receiveHit; every other peer applies here
    victim.deaths++
    const broken = victim.streak            // victim's tier BEFORE reset (for bounty/reset)
    victim.streak = 0
    let streak = 0, firstBlood = false
    if (shooter && shooter !== victim) {
      const bounty = bountyFrags(broken)
      const resetCd = breakResetsCooldowns(broken)
      shooter.kills += bounty               // scored (with bounty)
      shooter.streak++                      // killstreak — per real kill (+1)
      streak = shooter.streak
      if (!this.firstKillDone) { firstBlood = true; this.firstKillDone = true }
      if (resetCd) shooter.resetCooldowns()
    }
    this.scoresDirty = true
    this.announceStreak(shooterId, victimId, streak, firstBlood)
    if (shooter === this.human && victim !== this.human) {
      window.__debugTargetHitCount = (window.__debugTargetHitCount ?? 0) + 1
    }
    if (victim === this.human) this.dispatch({ type: 'PLAYER_HIT' })
  }

  /** Canonical block application — IDENTICAL on every peer (perfect-block reset mirrors everywhere). */
  private applyBlock(shooterId: number, victimId: number, perfect: boolean): void {
    if (this.predictedKill?.id === victimId) this.revertPredictedKill(victimId, 'block')
    if (perfect) this.byId.get(victimId)?.resetCooldowns()
    if (perfect && victimId === this.localId) this.achievements.onPerfectBlock()
    if (victimId === this.localId) this.dispatch({ type: 'SHIELD_BLOCK' })
    else if (shooterId === this.localId) this.dispatch({ type: 'BOT_SHIELD_HIT' })
  }

  /** Mesh: judge an incoming claim against a player THIS peer owns. The victim's REAL local state decides —
   *  alive / not a ghost / not a teammate / "the shield wins". The verdict broadcasts slim via resolveHit;
   *  a dropped claim needs no reply — the shooter's predicted death self-corrects from our snapshots (grace). */
  judgeClaim(claim: HitClaim): void {
    if (claim.hitId === null || !this.ownedIds.has(claim.hitId)) return   // not ours to judge
    const shooter = this.byId.get(claim.shooter)
    const victim = this.byId.get(claim.hitId)
    if (!shooter || !victim || victim === shooter) { gameLog.warn('act', 'claim_drop', { shooter: claim.shooter, victim: claim.hitId, reason: 'bad_target' }); return }
    if (shooter.team === victim.team) { gameLog.warn('act', 'claim_drop', { shooter: claim.shooter, victim: claim.hitId, reason: 'teammate' }); return }
    if (!victim.alive) { gameLog.log('act', 'claim_drop', { shooter: claim.shooter, victim: claim.hitId, reason: 'dead' }); return }
    const point = claim.point ? fromVec3(claim.point) : victim.position
    const dist = shooter.position.distanceTo(point)
    if (dist > AIM_RANGE) { gameLog.warn('act', 'claim_drop', { shooter: claim.shooter, victim: claim.hitId, reason: 'range', dist }); return }
    gameLog.log('act', 'claim_judge', { shooter: claim.shooter, victim: claim.hitId, dist })
    this.resolveHit(shooter, victim, point)
  }

  /** Mesh: route a local shot's claim — judge immediately when we own the victim (no network), else queue
   *  it addressed to the victim's owner. (Wired into the peer fire path by the cutover.) */
  queueOrJudge(claim: HitClaim): void {
    if (claim.hitId === null) return
    if (this.ownedIds.has(claim.hitId)) { this.judgeClaim(claim); return }
    this.pendingClaims.push({ to: this.ownerOf(claim.hitId), claim })
  }

  /** Addressed claims to ship this frame (cleared on read). */
  drainClaims(): Array<{ to: string; claim: HitClaim }> {
    const c = this.pendingClaims
    this.pendingClaims = []
    return c
  }

  /** client: predict the opponent's death on a local hit (instant feedback — no RTT wait for the host's 'kill').
   *  A false positive (the host rejects — out of range, or a shield raised within RTT) self-corrects from the next
   *  snapshot: applyNetState restores alive/respawning. Skip a visibly shielding opponent — their owner would judge it a block,
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
      if (!this.ownedIds.has(p.id)) continue   // a remote's ghost/respawn is its owner's fact (event + snapshots)
      if (!p.isRespawning) continue
      p.respawnTimer -= dt * 1000
      if (p.respawnTimer <= 0) {
        const pos = p.position.clone()
        p.respawnAt(pos)
        gameLog.log('act', 'respawn', { id: p.id })
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
    gameLog.log('health', 'tick', { role: this.role, peers: this.players.length })
  }

  /** Diag: log shield/dash on→off edges per player (local from the real sim; the client's opponent from snapshot flags). */
  private logActorEdges() {
    for (const p of this.players) {
      const remote = !this.ownedIds.has(p.id)
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

  /** Roll call of the OWNED players' moves + emit discrete move events (jump/land) to the other peers;
   *  remote moves arrive as their owners' 'move' events (applyEvent → sfx.move). */
  private sfxFrameOwned() {
    if (!this.sfx) return
    const owned = this.players.filter(p => this.ownedIds.has(p.id))
    // Lazy init of the pre-alloc buffer: id/obj/pos/windupStyle are stable, the rest is updated per-frame.
    if (this._sfxInputsBuf.length === 0) {
      this._sfxInputsBuf = owned.map(p => ({
        id: p.id, obj: p.bodyGroup, pos: p.position,   // pos — a reference to a Vector3 updated in-place
        shieldActive: false, dashing: false, grounded: null, justJumped: false,
        dashReady: null, shieldReady: null, windingUp: false, windupStyle: p.windupStyle,
        isLocal: p.id === this.localId,
      }))
    }
    for (let i = 0; i < owned.length; i++) {
      const p = owned[i]; const inp = this._sfxInputsBuf[i]
      inp.shieldActive = p.shieldActive; inp.dashing = p.dashing
      inp.grounded = p.grounded; inp.justJumped = p.justJumped
      inp.dashReady  = p.id === this.localId ? p.dashCooldownProgress() >= 1 : null
      inp.shieldReady = p.id === this.localId ? p.shieldProgress() >= 1 : null
      inp.windingUp = p.isWindingUp
    }
    const moves = this.sfx.frame(this._sfxInputsBuf)
    for (const m of moves) { gameLog.log('act', 'move', { id: m.id, kind: m.kind }); this.emit({ t: 'move', id: m.id, kind: m.kind, pos: toVec3(m.pos) }) }
  }

  /** e2e/debug: was match music constructed (seed+engine provided) and did the live frame start it. */
  musicState(): { created: boolean; started: boolean } {
    return { created: this.music !== null, started: this.musicStarted }
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
    if (this.readySet.has(id)) return
    this.readySet.add(id)
    if (this.ownedIds.has(id)) this.emit({ t: 'ready', id })   // announce OUR player's readiness to the mesh
    this.maybeStampCountdown()
  }

  /** Only the lobby CREATOR (owner of seat 0) stamps the countdown start — a single arbiter, no races.
   *  The stamp reaches the others as a phase message (skew ≤ RTT; wall clocks are not synchronized). */
  private maybeStampCountdown() {
    if (!this.iAmCreator() || this.phase !== 'ready') return
    if (this.players.every(p => this.readySet.has(p.id))) {
      this.phase = 'countdown'
      this.countdownEndsAt = Date.now() + READY_COUNTDOWN_MS
      this.phaseDirtyFlag = true
    }
  }

  iAmCreator(): boolean { return this.ownerOf(0) === this.selfPeer }
  creatorPeer(): string { return this.ownerOf(0) }

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

  /** A player disconnected: hide their avatar; the match ends only when fewer than two teams remain.
   *  Star topology: for a CLIENT the departed peer is always the host — no host, no match (mesh removes this). */
  handlePlayerLeft(id: number) {
    if (this.leftIds.has(id)) return
    this.leftIds.add(id)
    this.scoresDirty = true   // the table shows the "left" mark
    const p = this.byId.get(id)
    if (p) {
      p.bodyGroup.visible = false
      p.weaponObject.visible = false
      p.trailObject.visible = false
      p.windupFxObject.visible = false
      p.respawnFxObject.visible = false
    }
    const teamsAlive = new Set(this.players.filter(q => !this.leftIds.has(q.id)).map(q => q.team))
    if (teamsAlive.size < 2) this.endMatch('disconnect')
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
      this.dispatch({ type: 'SET_MATCH_TIME', seconds: Math.ceil(remaining / 1000) })   // each peer ticks its own clock
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
    // no matchEnd event: every peer ends deterministically (its own timer / the fewer-than-two-teams rule)
  }

  private computeResult(reason: 'time' | 'disconnect'): MatchResult {
    const scores = this.serializeScores()
    // Rank teams by summed kills (in 1v1/FFA a "team" is a single player — the table degenerates to personal).
    const byTeam = new Map<number, { kills: number; memberIds: number[] }>()
    for (const p of this.players) {
      const t = byTeam.get(p.team) ?? { kills: 0, memberIds: [] }
      t.kills += p.kills
      t.memberIds.push(p.id)
      byTeam.set(p.team, t)
    }
    const ranking: TeamRank[] = [...byTeam.entries()].map(([team, v]) => ({ team, ...v })).sort((a, b) => b.kills - a.kills)
    const myTeam = this.byId.get(this.localId)?.team ?? 0
    let outcome: 'win' | 'lose' | 'draw'
    if (reason === 'disconnect') {
      // The match collapsed to (at most) one present team: whoever remains wins, the departed lose.
      const remains = this.players.some(p => p.team === myTeam && !this.leftIds.has(p.id))
      outcome = remains ? 'win' : 'lose'
    } else {
      const top = ranking[0]?.kills ?? 0
      const topTeams = ranking.filter(r => r.kills === top)
      outcome = topTeams.some(r => r.team === myTeam) ? (topTeams.length > 1 ? 'draw' : 'win') : 'lose'
    }
    return { outcome, reason, scores, ranking }
  }

  /** Score rows for the HUD/result: keyed by id, with the team and a "left the match" mark. */
  private serializeScores() {
    return this.players.map(p => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths, team: p.team, left: this.leftIds.has(p.id) || undefined }))
  }

  private syncHud() {
    if (this.scoresDirty) {
      this.scoresDirty = false
      const scores = this.serializeScores()   // every peer derives its own table from the kill stream
      this.dispatch({ type: 'SET_SCORES', scores })
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
  /** Emit a fact THIS peer owns: queue for broadcast + apply locally to demo/sfx. Every peer emits its own facts. */
  private emit(e: MatchEvent) {
    this.pendingEvents.push(e)
    this.recorder?.event(e)            // dev: transient FX in the demo (the peer's own point of view)
    this.sfx?.combat(e, this.sfxPos)   // voice our own facts instantly; remote facts are voiced in applyEvent
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

  /** Snapshot of the players THIS peer owns (self + own bots) — the only facts we may broadcast. */
  serializeSnapshot(): Snapshot {
    const owned = this.players.filter(p => this.ownedIds.has(p.id))
    if (!this._snapBuf) {
      this._snapBuf = {
        tick: 0,
        players: owned.map(p => ({
          id: p.id,
          pos: [0, 0, 0] as [number, number, number],
          aimDir: [0, 0, 0] as [number, number, number],
          alive: true, shieldActive: false, dashing: false, windupProgress: 0, respawning: false,
        })),
      }
    }
    this._snapBuf.tick = this.tick   // sender's sim tick (interpolation ordering)
    for (let i = 0; i < owned.length; i++) owned[i].fillState(this._snapBuf.players[i])
    return this._snapBuf
  }

  /** Apply a snapshot from peer `from`: ONLY to the players that peer owns (attribution), never to our own. */
  applyPeerSnapshot(from: string, snap: Snapshot) {
    for (const ps of snap.players) {
      const p = this.byId.get(ps.id)
      if (!p) continue
      if (this.ownedIds.has(ps.id)) continue        // never accept our own facts from the wire
      if (this.ownerOf(ps.id) !== from) continue    // only the owner speaks for its players
      // Kill prediction: while a predicted death is latched, ignore the owner's snapshots that still show the victim
      // alive (sent before our claim reached it) so the ghost doesn't flicker. The owner's 'kill' clears the latch;
      // if the grace expires with no kill, the claim was rejected/lost → let the owner's snapshots revive it.
      const pk = this.predictedKill
      let state = ps
      if (pk && pk.id === ps.id && ps.alive) {
        if (Date.now() < pk.until) state = { ...ps, alive: false, respawning: true }
        else this.revertPredictedKill(ps.id, 'grace')   // grace expired — the claim was rejected or lost
      } else if (pk && pk.id === ps.id && !ps.alive) {
        this.predictedKill = null   // the owner confirmed the death — its snapshots own it now
      }
      p.applyNetState(state, snap.tick)
      // Remote's shield/dash — from snapshot flags by their transitions (jump/land arrive via a move event).
      this.sfx?.frame([{
        id: ps.id, obj: p.bodyGroup, pos: p.position,
        shieldActive: ps.shieldActive, dashing: ps.dashing, grounded: null, justJumped: false,
        dashReady: null, shieldReady: null, windingUp: ps.windupProgress > 0, windupStyle: p.windupStyle, isLocal: false,
      }])
    }
  }

  /** Apply an event from peer `from` with ownership attribution: only the owner speaks for its players
   *  (kill/block — the VICTIM's owner is the judge; fired/respawn/move/ready — the actor's owner). */
  applyPeerEvent(from: string, e: MatchEvent) {
    switch (e.t) {
      case 'kill':
      case 'block':
        if (this.ownerOf(e.victim) !== from) { gameLog.warn('act', 'event_drop', { t: e.t, from, victim: e.victim }); return }
        break
      case 'fired':
      case 'respawn':
      case 'move':
      case 'ready':
        if (this.ownerOf(e.id) !== from) { gameLog.warn('act', 'event_drop', { t: e.t, from, id: e.id }); return }
        break
      default: break
    }
    this.applyEvent(e)
  }

  /** Judge a claim sent to us: the sender must own the shooter; we must own the victim (checked in judgeClaim). */
  judgeIncomingClaim(from: string, claim: HitClaim) {
    if (this.ownerOf(claim.shooter) !== from) { gameLog.warn('act', 'claim_drop', { shooter: claim.shooter, from, reason: 'not_owner' }); return }
    this.judgeClaim(claim)
  }

  /** A transport peer vanished: every player it owned leaves (bots go down with their owner). */
  handlePeerLeft(peer: string) {
    for (const p of this.players) if (this.ownerOf(p.id) === peer) this.handlePlayerLeft(p.id)
  }

  /** Apply a match event (attribution already checked for network events; local events apply directly). */
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
        gameLog.log('act', 'kill', { side: 'remote', shooter: e.shooter, victim: e.victim })
        this.applyKill(e.shooter, e.victim)   // numbers are derived locally — the event ships only (shooter, victim)
        this.sfx?.combat(e, this.sfxPos)
        break
      }
      case 'block': {
        gameLog.log('act', 'block', { side: 'remote', shooter: e.shooter, victim: e.victim, perfect: e.perfect })
        this.applyBlock(e.shooter, e.victim, e.perfect)
        this.sfx?.combat(e, this.sfxPos)
        break
      }
      case 'ready': {
        // A remote peer announced one of its players ready; the creator stamps the countdown when complete.
        if (this.phase === 'ready' && this.players.some(pl => pl.id === e.id)) {
          this.readySet.add(e.id)
          this.maybeStampCountdown()
        }
        break
      }
      case 'respawn': {
        gameLog.log('act', 'respawn', { side: 'remote', id: e.id })
        this.byId.get(e.id)?.respawnAt(fromVec3(e.pos))
        this.sfx?.combat(e, this.sfxPos)
        break
      }
      case 'move': {
        if (e.id === this.localId) break   // our own movement is already played by prediction
        gameLog.log('act', 'move', { side: 'client', id: e.id, kind: e.kind })
        this.sfx?.move(e.kind, this.byId.get(e.id)?.position ?? fromVec3(e.pos))
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
    w.__debugRole = () => (this.iAmCreator() ? 'host' : 'client')   // e2e legacy naming: creator/guest (the match role is always 'peer')
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
