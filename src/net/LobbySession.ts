import type { INet, PeerId } from './INet'
import type { Hello, Assign, RosterEntry } from './protocol'
import type { BotDifficulty } from '../constants'
import { PLAYER_COLORS, BOT_COLOR_BASE, HOST_ID, OPPONENT_ID } from '../constants'
import type { PlayerProfile } from '../settings'

export type LobbyRole = 'host' | 'client'

const HELLO_RETRY_MS = 400   // клиент повторяет HELLO, пока не получит ASSIGN (надёжность под нагрузкой)

export interface LobbyView {
  roster: RosterEntry[]
  localPlayerId: number   // -1 у клиента, пока хост не назначил
  isHost: boolean
  connected: boolean      // клиент: получил ASSIGN
  canStart: boolean       // host: слот соперника занят → можно стартовать
}

/**
 * Хендшейк лобби (строго 1v1). Хост — владелец кода: держит себя (id 0) и ОДИН слот соперника (id 1) —
 * бот XOR подключившийся человек. Зашедший человек вытесняет бота. Клиент объявляется HELLO и получает
 * свой id + ростер. По START обе стороны строят Match с одинаковым ростером `[host, opponent]`.
 */
export class LobbySession {
  readonly net: INet
  readonly role: LobbyRole
  readonly code: string
  private hostEntry: RosterEntry
  private opponent: RosterEntry | null = null   // слот соперника: бот | человек | пусто
  private clientPeer: PeerId | null = null      // host: peer занявшего слот человека
  private localPlayerId: number
  private profile: PlayerProfile
  private changeCb: (v: LobbyView) => void = () => {}
  private startCb: () => void = () => {}
  private helloTimer: ReturnType<typeof setInterval> | null = null

  constructor(net: INet, role: LobbyRole, code: string, profile: PlayerProfile) {
    this.net = net
    this.role = role
    this.code = code
    this.profile = profile
    this.hostEntry = { id: HOST_ID, name: profile.name, color: profile.primaryColor, kind: 'human' }

    if (role === 'host') {
      this.localPlayerId = HOST_ID
      net.on('hello', (payload, from) => this.onHello(payload as Hello, from))
      net.onPeerLeave(peer => this.onPeerLeave(peer))
    } else {
      this.localPlayerId = -1
      net.on('assign', payload => this.onAssign(payload as Assign))
      net.on('start', () => this.startCb())
      net.onPeerJoin(() => this.sayHello())   // нашли хоста — представляемся
      this.sayHello()
      // Повторяем HELLO, пока не получим ASSIGN (сообщение могло потеряться/прийти до готовности
      // хоста). В loopback хендшейк уже синхронно завершён — таймер не нужен.
      if (this.localPlayerId < 0) this.helloTimer = setInterval(() => this.sayHello(), HELLO_RETRY_MS)
    }
  }

  // --- host ---
  private onHello(hello: Hello, from: PeerId) {
    // Человек занимает слот соперника, вытесняя бота. Слот занят ДРУГИМ человеком → лобби 1v1 полно.
    if (this.opponent?.kind === 'human' && this.clientPeer !== from) return
    const name = (hello.name || '').trim() || 'Соперник'
    this.opponent = { id: OPPONENT_ID, name, color: this.assignColor(hello.primaryColor, hello.reserveColor), kind: 'human' }
    this.clientPeer = from
    this.broadcastRoster()
  }

  /** Цвет соперника без коллизии с цветом хоста: основной → резервный → первый свободный из палитры. */
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
    this.broadcastRoster()
  }

  addBot(difficulty: BotDifficulty = 'normal') {
    if (this.role !== 'host' || this.opponent) return   // слот уже занят (бот или человек) — no-op
    this.opponent = { id: OPPONENT_ID, name: 'Бот', color: BOT_COLOR_BASE, kind: 'bot', difficulty }
    this.broadcastRoster()
  }

  removeBot() {
    if (this.role !== 'host' || this.opponent?.kind !== 'bot') return
    this.opponent = null
    this.broadcastRoster()
  }

  setBotDifficulty(d: BotDifficulty) {
    if (this.opponent?.kind === 'bot') { this.opponent.difficulty = d; this.broadcastRoster() }
  }

  private sendAssign(peer: PeerId) {
    this.net.send(peer, 'assign', { yourId: OPPONENT_ID, roster: this.roster() } satisfies Assign)
  }
  private broadcastRoster() {
    if (this.clientPeer) this.sendAssign(this.clientPeer)
    this.emitChange()
  }

  start() {
    if (this.role !== 'host' || !this.opponent) return
    this.net.broadcast('start', {})
    this.startCb()
  }

  // --- client ---
  private sayHello() {
    if (this.localPlayerId < 0) {
      const { name, primaryColor, reserveColor } = this.profile
      this.net.broadcast('hello', { name, primaryColor, reserveColor } satisfies Hello)
    }
  }
  private onAssign(a: Assign) {
    if (this.helloTimer) { clearInterval(this.helloTimer); this.helloTimer = null }   // подключились — хватит звать
    this.localPlayerId = a.yourId
    this.hostEntry = a.roster.find(r => r.id === HOST_ID) ?? this.hostEntry
    this.opponent = a.roster.find(r => r.id === OPPONENT_ID) ?? null
    this.emitChange()
  }

  /** Закрыть сессию: остановить ретраи HELLO и выйти из транспорта. */
  dispose() {
    if (this.helloTimer) { clearInterval(this.helloTimer); this.helloTimer = null }
    this.net.leave()
  }

  // --- общий API ---
  onChange(cb: (v: LobbyView) => void) { this.changeCb = cb; cb(this.view()) }
  onStart(cb: () => void) { this.startCb = cb }
  private emitChange() { this.changeCb(this.view()) }

  /** Ростер матча: ровно `[host, opponent]` (или только host, пока слот пуст). */
  private roster(): RosterEntry[] {
    return this.opponent ? [this.hostEntry, this.opponent] : [this.hostEntry]
  }

  view(): LobbyView {
    return {
      roster: this.roster(),
      localPlayerId: this.localPlayerId,
      isHost: this.role === 'host',
      connected: this.role === 'host' || this.localPlayerId >= 0,
      canStart: this.role === 'host' && this.opponent !== null,
    }
  }

  netConfig() { return { localId: this.localPlayerId, roster: this.roster() } }
  hostPeerToPlayer(): Map<PeerId, number> {
    return this.clientPeer ? new Map([[this.clientPeer, OPPONENT_ID]]) : new Map()
  }
}
