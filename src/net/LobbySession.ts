import type { INet, PeerId } from './INet'
import type { Hello, Assign, RosterEntry } from './protocol'
import type { BotDifficulty } from '../constants'
import { HUMAN_COLORS, BOT_COLOR_BASE, MAX_PLAYERS } from '../constants'

export type LobbyRole = 'host' | 'client'

export interface LobbyView {
  roster: RosterEntry[]
  localPlayerId: number   // -1 у клиента, пока хост не назначил
  isHost: boolean
  connected: boolean      // клиент: получил ASSIGN
}

/**
 * Хендшейк лобби поверх транспорта. Хост — владелец кода: держит ростер (себя + ботов +
 * подключившихся людей), раздаёт id/цвета и шлёт ASSIGN. Клиент объявляется HELLO и получает
 * свой id + ростер. По START обе стороны строят Match с одинаковым ростером.
 */
export class LobbySession {
  readonly net: INet
  readonly role: LobbyRole
  readonly code: string
  private roster: RosterEntry[] = []
  private localPlayerId: number
  private peerToPlayer = new Map<PeerId, number>()   // host: peer клиента → его playerId
  private nextId: number
  private myName: string
  private changeCb: (v: LobbyView) => void = () => {}
  private startCb: () => void = () => {}

  constructor(net: INet, role: LobbyRole, code: string, name: string) {
    this.net = net
    this.role = role
    this.code = code
    this.myName = name

    if (role === 'host') {
      this.localPlayerId = 0
      this.nextId = 1
      this.roster = [{ id: 0, name, color: HUMAN_COLORS[0], kind: 'human' }]
      net.on('hello', (payload, from) => this.onHello(payload as Hello, from))
      net.onPeerLeave(peer => this.onPeerLeave(peer))
    } else {
      this.localPlayerId = -1
      this.nextId = 0
      net.on('assign', payload => this.onAssign(payload as Assign))
      net.on('start', () => this.startCb())
      net.onPeerJoin(() => this.sayHello())   // нашли хоста — представляемся
      this.sayHello()
    }
  }

  // --- host ---
  private onHello(hello: Hello, from: PeerId) {
    if (this.peerToPlayer.has(from)) { this.sendAssign(from); return }   // повтор HELLO — переотправим
    if (this.roster.length >= MAX_PLAYERS) return
    const id = this.nextId++
    const humanCount = this.roster.filter(r => r.kind === 'human').length
    this.roster.push({ id, name: hello.name || `Игрок ${id + 1}`, color: HUMAN_COLORS[humanCount % HUMAN_COLORS.length], kind: 'human' })
    this.peerToPlayer.set(from, id)
    this.broadcastRoster()
  }

  private onPeerLeave(peer: PeerId) {
    const id = this.peerToPlayer.get(peer)
    if (id === undefined) return
    this.peerToPlayer.delete(peer)
    this.roster = this.roster.filter(r => r.id !== id)
    this.broadcastRoster()
  }

  addBot(difficulty: BotDifficulty = 'normal') {
    if (this.role !== 'host' || this.roster.length >= MAX_PLAYERS) return
    const botCount = this.roster.filter(r => r.kind === 'bot').length
    this.roster.push({ id: this.nextId++, name: `Бот ${botCount + 1}`, color: BOT_COLOR_BASE, kind: 'bot', difficulty })
    this.broadcastRoster()
  }

  removeBot(id: number) {
    if (this.role !== 'host') return
    this.roster = this.roster.filter(r => r.id !== id)
    this.renumberBots()
    this.broadcastRoster()
  }

  setBotDifficulty(id: number, d: BotDifficulty) {
    const e = this.roster.find(r => r.id === id)
    if (e && e.kind === 'bot') { e.difficulty = d; this.broadcastRoster() }
  }

  private renumberBots() {
    let n = 1
    for (const e of this.roster) if (e.kind === 'bot') e.name = `Бот ${n++}`
  }

  private sendAssign(peer: PeerId) {
    const yourId = this.peerToPlayer.get(peer)
    if (yourId !== undefined) this.net.send(peer, 'assign', { yourId, roster: this.roster } satisfies Assign)
  }
  private broadcastRoster() {
    for (const peer of this.peerToPlayer.keys()) this.sendAssign(peer)
    this.emitChange()
  }

  start() {
    if (this.role !== 'host') return
    this.net.broadcast('start', {})
    this.startCb()
  }

  // --- client ---
  private sayHello() {
    if (this.localPlayerId < 0) this.net.broadcast('hello', { name: this.myName } satisfies Hello)
  }
  private onAssign(a: Assign) {
    this.localPlayerId = a.yourId
    this.roster = a.roster
    this.emitChange()
  }

  // --- общий API ---
  onChange(cb: (v: LobbyView) => void) { this.changeCb = cb; cb(this.view()) }
  onStart(cb: () => void) { this.startCb = cb }
  private emitChange() { this.changeCb(this.view()) }

  view(): LobbyView {
    return {
      roster: this.roster,
      localPlayerId: this.localPlayerId,
      isHost: this.role === 'host',
      connected: this.role === 'host' || this.localPlayerId >= 0,
    }
  }

  netConfig() { return { localId: this.localPlayerId, roster: this.roster } }
  hostPeerToPlayer() { return this.peerToPlayer }
}
