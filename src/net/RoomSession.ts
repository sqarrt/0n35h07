import type { INet, PeerId } from './INet'
import type { Hello, Assign, Start, RosterEntry, ReadyMsg, SetSlotMsg, Vec3 } from './protocol'
import type { BotDifficulty, MapId, MapFilter, DurationFilter } from '../constants'
import { HOST_ID, DEFAULT_MATCH_DURATION_MIN, DEFAULT_MAP_ID, MATCH_DURATIONS_MIN } from '../constants'
import type { PlayerProfile } from '../settings'
import { generateModelName } from '../names'
import { botAppearance } from '../game/botAppearance'
import type { GameMode } from '../game/modes'
import { MODE_SLOT_COUNT, canStartFor } from '../game/modes'
import { genFfaSpawns } from '../game/spawns'
import { MAP_IDS, MAPS } from '../game/maps'
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
  slots: (RosterEntry | null)[]   // seat array of the current mode (entry.id === seat index)
  mode: GameMode
  localPlayerId: number   // -1 on client until host assigns
  isHost: boolean
  connected: boolean      // client: got ASSIGN
  foundHost: boolean      // client: transport found a peer (onPeerJoin) — handshake in progress; host: always true
  canStart: boolean       // host: the mode's start gate is satisfied
  durationMin: number
  mapId: MapId            // resolved match map
  mapSel: MapFilter       // this side's selection (for lobby tiles; may be 'any')
  durationSel: DurationFilter
  ready: number[]         // ids of ready players (for lobby indication)
}

/**
 * Room handshake on SLOTS. The mode (1v1/2v2/ffa) is a lobby preset: it fixes the seat count; the seat
 * index IS the player id (the lobby creator always sits in seat 0). Humans take the first free seat via
 * HELLO → ASSIGN; there is NO bot eviction — the host manages seats explicitly (addBot/removeBot), a client
 * may move to a free seat via setSlot (2v2 team change). On START every peer builds a Match with the same
 * roster; in FFA the creator also generates and ships the start positions.
 */
export class RoomSession {
  readonly net: INet
  readonly role: RoomRole
  readonly code: string
  private mode: GameMode = '1v1'
  private slots: (RosterEntry | null)[] = [null, null]
  private peerBySlot = new Map<number, PeerId>()   // host: which transport peer occupies a human seat
  private localPlayerId: number
  private profile: PlayerProfile
  private durationMin: number = DEFAULT_MATCH_DURATION_MIN
  private mapId: MapId = DEFAULT_MAP_ID
  private selMap: MapFilter = [DEFAULT_MAP_ID]          // set of selected maps — UI/Hello/resolve
  private selDuration: DurationFilter = [DEFAULT_MATCH_DURATION_MIN]
  private changeCb: (v: RoomView) => void = () => {}
  private startCb: (durationMs: number, mapId: MapId, mode: GameMode, spawns: Vec3[] | undefined, owners: Record<number, string>) => void = () => {}
  private helloTimer: ReturnType<typeof setInterval> | null = null
  private peerSeen = false   // client: transport found a peer at least once (for "room found" indication)
  private readyIds = new Set<number>()   // ids of ready players (bots are auto-ready; lobby start gate)
  private started = false                // guard: start() exactly once
  private clientOwners: Record<number, string> = {}   // client: owner map from the last Assign
  private hostPeer: PeerId | null = null               // client: the creator's transport peer (from the Assign sender)
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
    // Seat 0 pre-fill: the host really sits there; on a client it's a placeholder shown until ASSIGN arrives.
    this.slots[0] = this.profileEntry(HOST_ID)

    if (role === 'host') {
      this.localPlayerId = HOST_ID
      net.on('hello', (payload, from) => this.onHello(payload as Hello, from))
      net.on('ready', (payload, from) => this.onReady(payload as ReadyMsg, from))
      net.on('setSlot', (payload, from) => this.onSetSlot(payload as SetSlotMsg, from))
      net.onPeerLeave(peer => this.onPeerLeave(peer))
    } else {
      this.localPlayerId = -1
      net.on('assign', (payload, from) => this.onAssign(payload as Assign, from))
      net.on('start', payload => { const s = payload as Start; gameLog.log('room', 'start_recv', { mapId: s.mapId, durationMs: s.durationMs }); this.started = true; this.clearTimers(); this.startCb(s.durationMs, s.mapId, this.mode, s.spawns, s.owners) })
      net.onPeerJoin(() => { this.peerSeen = true; netDiagMark('peerSeen'); this.emitChange(); this.sayHello() })   // found the host — introduce ourselves
      // Multi-guest lobby: only the CREATOR's departure closes the room. Before the Assign lands we don't
      // know the creator yet — any leave counts (pair rendezvous semantics preserved).
      net.onPeerLeave(peer => { if (this.hostPeer === null || peer === this.hostPeer) this.onHostGone() })
      if (net.peers().length) this.peerSeen = true   // "with a friend" rendezvous: peer already visible before session is built
      this.sayHello()
      // Resend HELLO until we get ASSIGN (the message may be lost / arrive before the host is ready).
      // In loopback the handshake already completes synchronously — no timer needed.
      if (this.localPlayerId < 0) this.helloTimer = setInterval(() => this.sayHello(), HELLO_RETRY_MS)
      // Handshake watchdog: found the host but no ASSIGN within connectTimeoutSec → bail out.
      if (profile.connectTimeoutSec > 0) this.connectTimer = setTimeout(() => this.onConnectTimeout(), profile.connectTimeoutSec * 1000)
    }
  }

  private profileEntry(id: number): RosterEntry {
    const p = this.profile
    return { id, name: p.name, color: p.primaryColor, reserveColor: p.reserveColor, kind: 'human', ballModel: p.ballModel, windupStyle: p.windupStyle, respawnStyle: p.respawnStyle, dashStyle: p.dashStyle, shieldStyle: p.shieldStyle, ballArt: p.ballArt }
  }

  private occupied(): RosterEntry[] { return this.slots.filter((s): s is RosterEntry => s !== null) }
  private firstFreeSlot(): number { return this.slots.findIndex(s => s === null) }

  // --- host: mode & seats ---

  /** Host: switch the lobby preset. Occupied seats are compacted onto the lowest indices (creator stays 0
   *  as the lowest); blocked while more seats are occupied than the new mode offers — nobody is evicted silently. */
  setMode(m: GameMode) {
    if (this.role !== 'host' || this.started || m === this.mode) return
    const entries = this.occupied()
    if (entries.length > MODE_SLOT_COUNT[m]) { gameLog.warn('room', 'mode_blocked', { mode: m, occupied: entries.length }); return }
    const next: (RosterEntry | null)[] = Array.from({ length: MODE_SLOT_COUNT[m] }, () => null)
    const ready = new Set<number>()
    const peers = new Map<number, PeerId>()
    entries.forEach((e, i) => {
      next[i] = { ...e, id: i }
      if (this.readyIds.has(e.id)) ready.add(i)
      const peer = this.peerBySlot.get(e.id)
      if (peer !== undefined) peers.set(i, peer)
    })
    this.mode = m
    this.slots = next
    this.readyIds = ready
    this.peerBySlot = peers
    gameLog.log('room', 'mode_set', { mode: m })
    this.broadcastRoster()
  }

  private onHello(hello: Hello, from: PeerId) {
    netDiagMark('helloRecv', { from })
    // A HELLO retry from an already-seated peer → just re-send its ASSIGN (the first one may have been lost).
    const seated = [...this.peerBySlot.entries()].find(([, p]) => p === from)
    if (seated) { this.sendAssign(from); return }
    const slot = this.firstFreeSlot()
    if (slot < 0) { gameLog.warn('room', 'hello_reject_full', { from }); return }   // no free seat — no bot eviction
    const name = (hello.name || '').trim() || 'Opponent'
    this.slots[slot] = { id: slot, name, color: hello.primaryColor, reserveColor: hello.reserveColor, kind: 'human', ballModel: hello.ballModel ?? 'smooth', windupStyle: hello.windupStyle ?? 'classic', respawnStyle: hello.respawnStyle ?? 'echo', dashStyle: hello.dashStyle ?? 'streak', shieldStyle: hello.shieldStyle ?? 'dome', ballArt: hello.ballArt }
    this.peerBySlot.set(slot, from)
    this.readyIds.delete(slot)   // a fresh human is not ready
    this.resolveAgainst(hello.desiredMap ?? ALL_MAPS, hello.desiredDuration ?? ALL_DURS)
    this.broadcastRoster()
  }

  /** Host: a client asks to move to a FREE seat (2v2 team change; harmless elsewhere). */
  private onSetSlot(msg: SetSlotMsg, from: PeerId) {
    const fromSlot = [...this.peerBySlot.entries()].find(([, p]) => p === from)?.[0]
    if (fromSlot === undefined) return
    this.moveSlot(fromSlot, msg.slot)
  }

  private moveSlot(fromSlot: number, toSlot: number) {
    if (toSlot < 0 || toSlot >= this.slots.length || this.slots[toSlot] !== null || this.slots[fromSlot] === null) return
    this.slots[toSlot] = { ...this.slots[fromSlot]!, id: toSlot }
    this.slots[fromSlot] = null
    if (this.readyIds.delete(fromSlot)) this.readyIds.add(toSlot)
    const peer = this.peerBySlot.get(fromSlot)
    if (peer !== undefined) { this.peerBySlot.delete(fromSlot); this.peerBySlot.set(toSlot, peer) }
    gameLog.log('room', 'slot_move', { from: fromSlot, to: toSlot })
    this.broadcastRoster()
  }

  /** Client: ask the host to move me to a free seat. (The creator keeps seat 0 — the star topology and the
   *  menu backdrop assume id 0 is the creator; host-side team choice is done by seating bots/guests instead.) */
  requestSlot(slot: number) {
    if (this.role !== 'client' || this.started) return
    this.net.broadcast('setSlot', { slot } satisfies SetSlotMsg)
  }

  private onPeerLeave(peer: PeerId) {
    const seat = [...this.peerBySlot.entries()].find(([, p]) => p === peer)?.[0]
    if (seat === undefined) return
    this.slots[seat] = null
    this.peerBySlot.delete(seat)
    this.readyIds.delete(seat)
    this.broadcastRoster()
  }

  // --- host: bots ---

  /** Build a bot entry: the name drives both personality and appearance (same seed). */
  private makeBotEntry(name: string, difficulty: BotDifficulty, id: number): RosterEntry {
    const skin = botAppearance(name)
    return {
      id, name, kind: 'bot', difficulty,
      color: skin.color, reserveColor: skin.reserveColor,
      ballModel: skin.ballModel, windupStyle: skin.windupStyle,
      respawnStyle: skin.respawnStyle, dashStyle: skin.dashStyle, shieldStyle: skin.shieldStyle,
    }
  }

  addBot(difficulty: BotDifficulty = 'normal', name?: string, slot?: number) {
    if (this.role !== 'host' || this.started) return
    const target = slot ?? this.firstFreeSlot()
    if (target < 0 || target >= this.slots.length || this.slots[target] !== null) return   // no free/valid seat — no-op
    // Name from the lobby field if set; otherwise generate a "model" (RA9, T-2000, …).
    const botName = (name ?? '').trim() || generateModelName()
    this.slots[target] = this.makeBotEntry(botName, difficulty, target)
    this.readyIds.add(target)   // bot is auto-ready
    this.resolveAgainst(ALL_MAPS, ALL_DURS)   // bot accepts anything → random from the host's set
    this.broadcastRoster()
  }

  /** Remove the bot at `slot`; without an argument — the first bot seat (1v1 compat). */
  removeBot(slot?: number) {
    if (this.role !== 'host') return
    const target = slot ?? this.slots.findIndex(s => s?.kind === 'bot')
    if (target < 0 || this.slots[target]?.kind !== 'bot') return
    this.slots[target] = null
    this.readyIds.delete(target)
    this.broadcastRoster()
  }

  /** Difficulty applies to ALL bots (single lobby picker — v1 UX). */
  setBotDifficulty(d: BotDifficulty) {
    let changed = false
    for (const s of this.slots) if (s?.kind === 'bot') { s.difficulty = d; changed = true }
    if (changed) this.broadcastRoster()
  }

  /** Rename a bot live: the name re-derives personality+appearance. Without `slot` — the first bot (1v1 compat).
   *  No-op if the seat isn't a bot or the name is empty. */
  setBotName(name: string, slot?: number) {
    const target = slot ?? this.slots.findIndex(s => s?.kind === 'bot')
    if (target < 0 || this.slots[target]?.kind !== 'bot') return
    const botName = name.trim()
    if (!botName) return   // empty field — keep the current (random) bot
    this.slots[target] = this.makeBotEntry(botName, this.slots[target]!.difficulty ?? 'normal', target)
    this.broadcastRoster()
  }

  // --- host: assign/start ---

  /** Owner map: humans — the peer occupying the seat; the creator's own seat and every bot — the creator's peer. */
  private ownersMap(): Record<number, string> {
    const owners: Record<number, string> = {}
    for (const e of this.occupied()) owners[e.id] = this.peerBySlot.get(e.id) ?? this.net.selfId
    return owners
  }

  private sendAssign(peer: PeerId) {
    const yourId = [...this.peerBySlot.entries()].find(([, p]) => p === peer)?.[0]
    if (yourId === undefined) return
    netDiagMark('assignSent', { peer })
    gameLog.log('room', 'assign_send', { mapId: this.mapId, durationMin: this.durationMin, yourId })
    this.net.send(peer, 'assign', { yourId, roster: this.roster(), durationMin: this.durationMin, mapId: this.mapId, ready: [...this.readyIds], mode: this.mode, owners: this.ownersMap() } satisfies Assign)
  }
  private broadcastRoster() {
    for (const peer of this.peerBySlot.values()) this.sendAssign(peer)
    this.emitChange()
  }

  start() {
    if (this.role !== 'host' || this.started) return
    if (!canStartFor(this.mode, this.occupied().length)) return
    this.started = true
    const durationMs = this.durationMin * 60_000
    // FFA: the creator generates the start positions and ships them — identical on every peer, no shared RNG.
    const spawns = this.mode === 'ffa' ? genFfaSpawns(this.occupied().length, MAPS[this.mapId].spawns[0][1]) : undefined
    gameLog.log('room', 'start_send', { mapId: this.mapId, durationMs, mode: this.mode })
    this.net.broadcast('start', { durationMs, mapId: this.mapId, spawns, owners: this.ownersMap() } satisfies Start)
    this.startCb(durationMs, this.mapId, this.mode, spawns, this.ownersMap())
  }

  /** Local player readiness. Host sets its own and checks for start; client sends it to the host. */
  setLocalReady(ready: boolean) {
    if (this.role === 'host') {
      if (ready) this.readyIds.add(this.localPlayerId); else this.readyIds.delete(this.localPlayerId)
      this.broadcastRoster()
      this.maybeStart()
    } else {
      this.net.broadcast('ready', { ready } satisfies ReadyMsg)
    }
  }

  /** host: a human guest's readiness (bots are auto-ready and never reach here). */
  private onReady(msg: ReadyMsg, from: PeerId) {
    const seat = [...this.peerBySlot.entries()].find(([, p]) => p === from)?.[0]
    if (seat === undefined) return
    if (msg.ready) this.readyIds.add(seat); else this.readyIds.delete(seat)
    this.broadcastRoster()
    this.maybeStart()
  }

  /** host: the mode's start gate is satisfied and every occupied seat is ready → start the match. */
  private maybeStart() {
    if (this.role !== 'host') return
    const occ = this.occupied()
    if (!canStartFor(this.mode, occ.length)) return
    if (occ.every(e => this.readyIds.has(e.id))) this.start()
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
    if (this.role === 'host') this.broadcastRoster()   // clients will see the choice in Assign
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
  private onAssign(a: Assign, from: PeerId) {
    this.hostPeer = from
    netDiagMark('assignRecv')
    this.clearTimers()   // connected — stop calling HELLO and watching the handshake
    this.localPlayerId = a.yourId
    this.mode = a.mode
    this.clientOwners = a.owners
    this.slots = Array.from({ length: MODE_SLOT_COUNT[a.mode] }, (_, i) => a.roster.find(r => r.id === i) ?? null)
    this.durationMin = a.durationMin
    this.mapId = a.mapId
    this.selMap = [a.mapId]
    this.selDuration = [a.durationMin]
    this.readyIds = new Set(a.ready)
    gameLog.log('room', 'assign_recv', { mapId: a.mapId, durationMin: a.durationMin, yourId: a.yourId, mode: a.mode })
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
  onStart(cb: (durationMs: number, mapId: MapId, mode: GameMode, spawns: Vec3[] | undefined, owners: Record<number, string>) => void) { this.startCb = cb }
  /** Client: session closed before the match (host left / handshake timeout). Never fires on the host. */
  onClosed(cb: () => void) { this.closedCb = cb }
  private emitChange() { this.changeCb(this.view()) }

  /** Match roster: every occupied seat (entry.id === seat index). */
  private roster(): RosterEntry[] { return this.occupied() }

  view(): RoomView {
    return {
      roster: this.roster(),
      slots: [...this.slots],
      mode: this.mode,
      localPlayerId: this.localPlayerId,
      isHost: this.role === 'host',
      connected: this.role === 'host' || this.localPlayerId >= 0,
      foundHost: this.role === 'host' || this.peerSeen,
      canStart: this.role === 'host' && canStartFor(this.mode, this.occupied().length),
      durationMin: this.durationMin,
      mapId: this.mapId,
      mapSel: this.selMap,
      durationSel: this.selDuration,
      ready: [...this.readyIds],
    }
  }

  netConfig() { return { localId: this.localPlayerId, roster: this.roster(), mode: this.mode, owners: this.role === 'host' ? this.ownersMap() : this.clientOwners } }
  hostPeerToPlayer(): Map<PeerId, number> {
    return new Map([...this.peerBySlot.entries()].map(([slot, peer]) => [peer, slot]))
  }
}
