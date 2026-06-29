import type { INet, PeerId } from './INet'
import type { Hello, Assign, Start, RosterEntry, ReadyMsg } from './protocol'
import type { BotDifficulty, MapId, MapFilter, DurationFilter } from '../constants'
import { PLAYER_COLORS, HOST_ID, OPPONENT_ID, DEFAULT_MATCH_DURATION_MIN, DEFAULT_MAP_ID, MATCH_DURATIONS_MIN } from '../constants'
import type { PlayerProfile } from '../settings'
import { generateModelName } from '../names'
import { botAppearance } from '../game/botAppearance'
import { MAP_IDS } from '../game/maps'
import { resolveMatchParams } from './matchmaking'
import { netDiagMark, netDiagLogVerdict } from './netDiag'
import { gameLog } from '../diag/gameLog'

export type RoomRole = 'host' | 'client'

const HELLO_RETRY_MS = 400   // client resends HELLO until it gets ASSIGN (reliability under load)
const ALL_MAPS: MapId[] = MAP_IDS
const ALL_DURS: number[] = [...MATCH_DURATIONS_MIN]
const pickRandom = <T>(opts: T[]): T => opts[Math.floor(Math.random() * opts.length)]

export interface RoomView {
  roster: RosterEntry[]
  localPlayerId: number   // -1 on client until host assigns
  isHost: boolean
  connected: boolean      // client: got ASSIGN
  foundHost: boolean      // client: transport found a peer (onPeerJoin) — handshake in progress; host: always true
  canStart: boolean       // host: opponent slot filled → can start
  durationMin: number
  mapId: MapId            // resolved match map
  mapSel: MapFilter       // this side's selection (for lobby tiles; may be 'any')
  durationSel: DurationFilter
  ready: number[]         // ids of ready players (for lobby indication)
}

/**
 * Room handshake (strictly 1v1). Host owns the code: holds itself (id 0) and ONE opponent slot (id 1) —
 * a bot XOR a connected human. An arriving human evicts the bot. The client announces itself via HELLO and
 * gets its id + roster. On START both sides build a Match with the same roster `[host, opponent]`.
 */
export class RoomSession {
  readonly net: INet
  readonly role: RoomRole
  readonly code: string
  private hostEntry: RosterEntry
  private opponent: RosterEntry | null = null   // opponent slot: bot | human | empty
  private clientPeer: PeerId | null = null      // host: peer of the human occupying the slot
  private localPlayerId: number
  private profile: PlayerProfile
  private durationMin: number = DEFAULT_MATCH_DURATION_MIN
  private mapId: MapId = DEFAULT_MAP_ID
  private selMap: MapFilter = [DEFAULT_MAP_ID]          // set of selected maps — UI/Hello/resolve
  private selDuration: DurationFilter = [DEFAULT_MATCH_DURATION_MIN]
  private changeCb: (v: RoomView) => void = () => {}
  private startCb: (durationMs: number, mapId: MapId) => void = () => {}
  private helloTimer: ReturnType<typeof setInterval> | null = null
  private peerSeen = false   // client: transport found a peer at least once (for "room found" indication)
  private readyIds = new Set<number>()   // ids of ready players (bot is auto-ready; lobby start gate)
  private started = false                // guard: start() exactly once
  private disposed = false
  private connectTimer: ReturnType<typeof setTimeout> | null = null   // client: handshake watchdog
  private closedCb: () => void = () => {}   // client: host left / handshake timeout → revert to pre-search state

  constructor(net: INet, role: RoomRole, code: string, profile: PlayerProfile, sel?: { map: MapFilter; durationMin: DurationFilter }) {
    this.net = net
    this.role = role
    this.code = code
    this.profile = profile
    if (sel) {
      this.selMap = sel.map; this.selDuration = sel.durationMin
      if (sel.map.length) this.mapId = sel.map[0]
      if (sel.durationMin.length) this.durationMin = sel.durationMin[0]
    }
    this.hostEntry = { id: HOST_ID, name: profile.name, color: profile.primaryColor, kind: 'human', ballModel: profile.ballModel, windupStyle: profile.windupStyle, respawnStyle: profile.respawnStyle, dashStyle: profile.dashStyle, shieldStyle: profile.shieldStyle, ballArt: profile.ballArt }

    if (role === 'host') {
      this.localPlayerId = HOST_ID
      net.on('hello', (payload, from) => this.onHello(payload as Hello, from))
      net.on('ready', (payload, from) => this.onReady(payload as ReadyMsg, from))
      net.onPeerLeave(peer => this.onPeerLeave(peer))
    } else {
      this.localPlayerId = -1
      net.on('assign', payload => this.onAssign(payload as Assign))
      net.on('start', payload => { const s = payload as Start; gameLog.log('room', 'start_recv', { mapId: s.mapId, durationMs: s.durationMs }); this.started = true; this.clearTimers(); this.startCb(s.durationMs, s.mapId) })
      net.onPeerJoin(() => { this.peerSeen = true; netDiagMark('peerSeen'); this.emitChange(); this.sayHello() })   // found the host — introduce ourselves
      net.onPeerLeave(() => this.onHostGone())   // host left to lobby → client rolls back to search
      if (net.peers().length) this.peerSeen = true   // "with a friend" rendezvous: peer already visible before session is built
      this.sayHello()
      // Resend HELLO until we get ASSIGN (the message may be lost / arrive before the host is ready).
      // In loopback the handshake already completes synchronously — no timer needed.
      if (this.localPlayerId < 0) this.helloTimer = setInterval(() => this.sayHello(), HELLO_RETRY_MS)
      // Handshake watchdog: found the host but no ASSIGN within connectTimeoutSec → bail out.
      if (profile.connectTimeoutSec > 0) this.connectTimer = setTimeout(() => this.onConnectTimeout(), profile.connectTimeoutSec * 1000)
    }
  }

  // --- host ---
  private onHello(hello: Hello, from: PeerId) {
    netDiagMark('helloRecv', { from })
    // Human takes the opponent slot, evicting the bot. Slot held by ANOTHER human → 1v1 room is full.
    if (this.opponent?.kind === 'human' && this.clientPeer !== from) {
      gameLog.warn('room', 'hello_reject_full', { from }); return   // room already has another human
    }
    const name = (hello.name || '').trim() || 'Opponent'
    this.opponent = { id: OPPONENT_ID, name, color: this.assignColor(hello.primaryColor, hello.reserveColor), kind: 'human', ballModel: hello.ballModel ?? 'smooth', windupStyle: hello.windupStyle ?? 'classic', respawnStyle: hello.respawnStyle ?? 'echo', dashStyle: hello.dashStyle ?? 'streak', shieldStyle: hello.shieldStyle ?? 'dome', ballArt: hello.ballArt }
    this.clientPeer = from
    this.readyIds.delete(OPPONENT_ID)   // the new human isn't ready yet (evicted the bot)
    this.resolveAgainst(hello.desiredMap ?? ALL_MAPS, hello.desiredDuration ?? ALL_DURS)
    this.broadcastRoster()
  }

  /** Opponent color without colliding with the host's: primary → reserve → first free in the palette. */
  private assignColor(primary: string, reserve: string): string {
    const host = this.hostEntry.color
    if (primary !== host) return primary
    if (reserve !== host) return reserve
    return PLAYER_COLORS.find(c => c !== host) ?? primary
  }

  private onPeerLeave(peer: PeerId) {
    if (peer !== this.clientPeer) return
    this.opponent = null
    this.clientPeer = null
    this.readyIds.delete(OPPONENT_ID)
    this.broadcastRoster()
  }

  /** Build a bot entry: the name drives both personality and appearance (same seed); color avoids host collision. */
  private makeBotEntry(name: string, difficulty: BotDifficulty): RosterEntry {
    const skin = botAppearance(name)
    return {
      id: OPPONENT_ID, name, kind: 'bot', difficulty,
      color: this.assignColor(skin.color, skin.color),
      ballModel: skin.ballModel, windupStyle: skin.windupStyle,
      respawnStyle: skin.respawnStyle, dashStyle: skin.dashStyle, shieldStyle: skin.shieldStyle,
    }
  }

  addBot(difficulty: BotDifficulty = 'normal', name?: string) {
    if (this.role !== 'host' || this.opponent) return   // slot already filled (bot or human) — no-op
    // Name from the lobby field if set; otherwise generate a "model" (RA9, T-2000, …).
    const botName = (name ?? '').trim() || generateModelName()
    this.opponent = this.makeBotEntry(botName, difficulty)
    this.readyIds.add(OPPONENT_ID)   // bot is auto-ready
    this.resolveAgainst(ALL_MAPS, ALL_DURS)   // bot accepts anything → random from the host's set
    this.broadcastRoster()
  }

  removeBot() {
    if (this.role !== 'host' || this.opponent?.kind !== 'bot') return
    this.opponent = null
    this.readyIds.delete(OPPONENT_ID)
    this.broadcastRoster()
  }

  setBotDifficulty(d: BotDifficulty) {
    if (this.opponent?.kind === 'bot') { this.opponent.difficulty = d; this.broadcastRoster() }
  }

  /** Rename the bot live: the name re-derives personality+appearance. No-op if the slot isn't a bot or the name is empty. */
  setBotName(name: string) {
    if (this.opponent?.kind !== 'bot') return
    const botName = name.trim()
    if (!botName) return   // empty field — keep the current (random) bot
    this.opponent = this.makeBotEntry(botName, this.opponent.difficulty ?? 'normal')
    this.broadcastRoster()
  }

  private sendAssign(peer: PeerId) {
    netDiagMark('assignSent', { peer })
    gameLog.log('room', 'assign_send', { mapId: this.mapId, durationMin: this.durationMin })
    this.net.send(peer, 'assign', { yourId: OPPONENT_ID, roster: this.roster(), durationMin: this.durationMin, mapId: this.mapId, ready: [...this.readyIds] } satisfies Assign)
  }
  private broadcastRoster() {
    if (this.clientPeer) this.sendAssign(this.clientPeer)
    this.emitChange()
  }

  start() {
    if (this.role !== 'host' || !this.opponent || this.started) return
    this.started = true
    const durationMs = this.durationMin * 60_000
    gameLog.log('room', 'start_send', { mapId: this.mapId, durationMs })
    this.net.broadcast('start', { durationMs, mapId: this.mapId } satisfies Start)
    this.startCb(durationMs, this.mapId)
  }

  /** Local player readiness. Host sets its own and checks for start; client sends it to the host. */
  setLocalReady(ready: boolean) {
    if (this.role === 'host') {
      if (ready) this.readyIds.add(HOST_ID); else this.readyIds.delete(HOST_ID)
      this.broadcastRoster()
      this.maybeStart()
    } else {
      this.net.broadcast('ready', { ready } satisfies ReadyMsg)
    }
  }

  /** host: human opponent's readiness (the bot is auto-ready and never reaches here). */
  private onReady(msg: ReadyMsg, from: PeerId) {
    if (from !== this.clientPeer || this.opponent?.kind !== 'human') return
    if (msg.ready) this.readyIds.add(OPPONENT_ID); else this.readyIds.delete(OPPONENT_ID)
    this.broadcastRoster()
    this.maybeStart()
  }

  /** host: both ready and slot filled → start the match. */
  private maybeStart() {
    if (this.role !== 'host' || !this.opponent) return
    if (this.readyIds.has(HOST_ID) && this.readyIds.has(OPPONENT_ID)) this.start()
  }

  /** host: resolve the final match params from its own selection and the opponent's wishes. */
  private resolveAgainst(clientMap: MapFilter, clientDur: DurationFilter) {
    const r = resolveMatchParams({ map: this.selMap, durationMin: this.selDuration }, { map: clientMap, durationMin: clientDur }, pickRandom, pickRandom)
    this.mapId = r.mapId
    this.durationMin = r.durationMin
    this.selMap = [r.mapId]         // after resolve the selector shows the concrete result (locked)
    this.selDuration = [r.durationMin]
    gameLog.log('nego', 'resolved', { mapId: this.mapId, durationMin: this.durationMin })
  }

  setDuration(mins: DurationFilter) {
    this.selDuration = mins
    if (mins.length) this.durationMin = mins[0]
    gameLog.log('nego', 'set_duration', { role: this.role, sel: this.selDuration, durationMin: this.durationMin })
    if (this.role === 'host') this.broadcastRoster()   // client will see the choice in Assign
    else this.emitChange()                             // client: local UI; the wish ships out in Hello
  }

  setMap(maps: MapFilter) {
    this.selMap = maps
    if (maps.length) this.mapId = maps[0]
    gameLog.log('nego', 'set_map', { role: this.role, sel: this.selMap, mapId: this.mapId })
    if (this.role === 'host') this.broadcastRoster()
    else this.emitChange()
  }

  // --- client ---
  private sayHello() {
    if (this.localPlayerId < 0) {
      netDiagMark('helloSent')
      const { name, primaryColor, reserveColor, ballModel, windupStyle, respawnStyle, dashStyle, shieldStyle, ballArt } = this.profile
      this.net.broadcast('hello', { name, primaryColor, reserveColor, desiredMap: this.selMap, desiredDuration: this.selDuration, ballModel, windupStyle, respawnStyle, dashStyle, shieldStyle, ballArt } satisfies Hello)
    }
  }
  private onAssign(a: Assign) {
    netDiagMark('assignRecv')
    this.clearTimers()   // connected — stop calling HELLO and watching the handshake
    this.localPlayerId = a.yourId
    this.hostEntry = a.roster.find(r => r.id === HOST_ID) ?? this.hostEntry
    this.opponent = a.roster.find(r => r.id === OPPONENT_ID) ?? null
    this.durationMin = a.durationMin
    this.mapId = a.mapId
    this.selMap = [a.mapId]
    this.selDuration = [a.durationMin]
    this.readyIds = new Set(a.ready)
    gameLog.log('room', 'assign_recv', { mapId: a.mapId, durationMin: a.durationMin })
    this.emitChange()
  }

  /** Close the session: stop timers and leave the transport. */
  dispose() {
    this.disposed = true
    this.clearTimers()
    this.net.leave()
  }

  private clearTimers() {
    if (this.helloTimer) { clearInterval(this.helloTimer); this.helloTimer = null }
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null }
  }

  /** Client: host left the room before match start (after start, disconnects are handled by NetSession). */
  private onHostGone() {
    if (this.started || this.disposed) return
    gameLog.warn('transport', 'host_gone', { peerSeen: this.peerSeen, connected: this.localPlayerId >= 0 })
    this.clearTimers()
    this.closedCb()
  }

  /** Client: ASSIGN didn't arrive in time → treat the connection as failed. */
  private onConnectTimeout() {
    this.connectTimer = null
    if (this.localPlayerId >= 0 || this.started || this.disposed) return   // already connected/started/closed
    gameLog.warn('room', 'connect_timeout', { sec: this.profile.connectTimeoutSec, peerSeen: this.peerSeen })
    netDiagLogVerdict()   // attach the ICE/handshake failure-layer verdict
    this.clearTimers()
    this.closedCb()
  }

  // --- shared API ---
  onChange(cb: (v: RoomView) => void) { this.changeCb = cb; cb(this.view()) }
  onStart(cb: (durationMs: number, mapId: MapId) => void) { this.startCb = cb }
  /** Client: session closed before the match (host left / handshake timeout). Never fires on the host. */
  onClosed(cb: () => void) { this.closedCb = cb }
  private emitChange() { this.changeCb(this.view()) }

  /** Match roster: exactly `[host, opponent]` (or just host while the slot is empty). */
  private roster(): RosterEntry[] {
    return this.opponent ? [this.hostEntry, this.opponent] : [this.hostEntry]
  }

  view(): RoomView {
    return {
      roster: this.roster(),
      localPlayerId: this.localPlayerId,
      isHost: this.role === 'host',
      connected: this.role === 'host' || this.localPlayerId >= 0,
      foundHost: this.role === 'host' || this.peerSeen,
      canStart: this.role === 'host' && this.opponent !== null,
      durationMin: this.durationMin,
      mapId: this.mapId,
      mapSel: this.selMap,
      durationSel: this.selDuration,
      ready: [...this.readyIds],
    }
  }

  netConfig() { return { localId: this.localPlayerId, roster: this.roster() } }
  hostPeerToPlayer(): Map<PeerId, number> {
    return this.clientPeer ? new Map([[this.clientPeer, OPPONENT_ID]]) : new Map()
  }
}
