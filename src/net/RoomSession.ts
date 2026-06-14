import type { INet, PeerId } from './INet'
import type { Hello, Assign, Start, RosterEntry, ReadyMsg } from './protocol'
import type { BotDifficulty, MapId, MapFilter, DurationFilter } from '../constants'
import { PLAYER_COLORS, BOT_COLOR_BASE, HOST_ID, OPPONENT_ID, DEFAULT_MATCH_DURATION_MIN, DEFAULT_MAP_ID, MATCH_DURATIONS_MIN } from '../constants'
import type { PlayerProfile } from '../settings'
import { generateModelName } from '../names'
import { MAP_IDS } from '../game/maps'
import { resolveMatchParams } from './matchmaking'

export type RoomRole = 'host' | 'client'

const HELLO_RETRY_MS = 400   // клиент повторяет HELLO, пока не получит ASSIGN (надёжность под нагрузкой)
const ALL_MAPS: MapId[] = MAP_IDS
const ALL_DURS: number[] = [...MATCH_DURATIONS_MIN]
const pickRandom = <T>(opts: T[]): T => opts[Math.floor(Math.random() * opts.length)]

export interface RoomView {
  roster: RosterEntry[]
  localPlayerId: number   // -1 у клиента, пока хост не назначил
  isHost: boolean
  connected: boolean      // клиент: получил ASSIGN
  foundHost: boolean      // клиент: транспорт нашёл пира (onPeerJoin) — идёт хендшейк; host: всегда true
  canStart: boolean       // host: слот соперника занят → можно стартовать
  durationMin: number
  mapId: MapId            // концертная карта матча (резолв)
  mapSel: MapFilter       // выбор стороны (для плиток лобби; может быть 'any')
  durationSel: DurationFilter
  ready: number[]         // id готовых игроков (для индикации в лобби)
}

/**
 * Хендшейк комнаты (строго 1v1). Хост — владелец кода: держит себя (id 0) и ОДИН слот соперника (id 1) —
 * бот XOR подключившийся человек. Зашедший человек вытесняет бота. Клиент объявляется HELLO и получает
 * свой id + ростер. По START обе стороны строят Match с одинаковым ростером `[host, opponent]`.
 */
export class RoomSession {
  readonly net: INet
  readonly role: RoomRole
  readonly code: string
  private hostEntry: RosterEntry
  private opponent: RosterEntry | null = null   // слот соперника: бот | человек | пусто
  private clientPeer: PeerId | null = null      // host: peer занявшего слот человека
  private localPlayerId: number
  private profile: PlayerProfile
  private durationMin: number = DEFAULT_MATCH_DURATION_MIN
  private mapId: MapId = DEFAULT_MAP_ID
  private selMap: MapFilter = [DEFAULT_MAP_ID]          // набор выбранных карт — UI/Hello/резолв
  private selDuration: DurationFilter = [DEFAULT_MATCH_DURATION_MIN]
  private changeCb: (v: RoomView) => void = () => {}
  private startCb: (durationMs: number, mapId: MapId) => void = () => {}
  private helloTimer: ReturnType<typeof setInterval> | null = null
  private peerSeen = false   // клиент: транспорт хотя бы раз нашёл пира (для индикации «комната найдена»)
  private readyIds = new Set<number>()   // id готовых игроков (бот авто-готов; гейт старта в лобби)
  private started = false                // guard: start() ровно один раз
  private disposed = false
  private connectTimer: ReturnType<typeof setTimeout> | null = null   // клиент: сторож хендшейка
  private closedCb: () => void = () => {}   // клиент: хост ушёл / таймаут хендшейка → вернуть в состояние до поиска

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
      net.on('start', payload => { const s = payload as Start; this.started = true; this.clearTimers(); this.startCb(s.durationMs, s.mapId) })
      net.onPeerJoin(() => { this.peerSeen = true; this.emitChange(); this.sayHello() })   // нашли хоста — представляемся
      net.onPeerLeave(() => this.onHostGone())   // хост ушёл в лобби → клиент откатывается до поиска
      this.sayHello()
      // Повторяем HELLO, пока не получим ASSIGN (сообщение могло потеряться/прийти до готовности
      // хоста). В loopback хендшейк уже синхронно завершён — таймер не нужен.
      if (this.localPlayerId < 0) this.helloTimer = setInterval(() => this.sayHello(), HELLO_RETRY_MS)
      // Сторож хендшейка: нашли хоста, но ASSIGN не пришёл за connectTimeoutSec → отвалиться.
      if (profile.connectTimeoutSec > 0) this.connectTimer = setTimeout(() => this.onConnectTimeout(), profile.connectTimeoutSec * 1000)
    }
  }

  // --- host ---
  private onHello(hello: Hello, from: PeerId) {
    // Человек занимает слот соперника, вытесняя бота. Слот занят ДРУГИМ человеком → комната 1v1 полна.
    if (this.opponent?.kind === 'human' && this.clientPeer !== from) return
    const name = (hello.name || '').trim() || 'Соперник'
    this.opponent = { id: OPPONENT_ID, name, color: this.assignColor(hello.primaryColor, hello.reserveColor), kind: 'human', ballModel: hello.ballModel ?? 'smooth', windupStyle: hello.windupStyle ?? 'classic', respawnStyle: hello.respawnStyle ?? 'echo', dashStyle: hello.dashStyle ?? 'streak', shieldStyle: hello.shieldStyle ?? 'dome', ballArt: hello.ballArt }
    this.clientPeer = from
    this.readyIds.delete(OPPONENT_ID)   // новый человек ещё не готов (вытеснил бота)
    this.resolveAgainst(hello.desiredMap ?? ALL_MAPS, hello.desiredDuration ?? ALL_DURS)
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
    this.readyIds.delete(OPPONENT_ID)
    this.broadcastRoster()
  }

  addBot(difficulty: BotDifficulty = 'normal') {
    if (this.role !== 'host' || this.opponent) return   // слот уже занят (бот или человек) — no-op
    // Имя-«модель» генерируем заново при каждом добавлении бота (RA9, T-2000, …).
    // Косметику не задаём: поля optional, Match подставит дефолты ('smooth'/'classic'/'echo'/'streak'/'dome').
    this.opponent = { id: OPPONENT_ID, name: generateModelName(), color: BOT_COLOR_BASE, kind: 'bot', difficulty }
    this.readyIds.add(OPPONENT_ID)   // бот авто-готов
    this.resolveAgainst(ALL_MAPS, ALL_DURS)   // бот принимает всё → случайное из набора хоста
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

  private sendAssign(peer: PeerId) {
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
    this.net.broadcast('start', { durationMs, mapId: this.mapId } satisfies Start)
    this.startCb(durationMs, this.mapId)
  }

  /** Локальная готовность игрока. Хост — ставит свою и проверяет старт; клиент — шлёт хосту. */
  setLocalReady(ready: boolean) {
    if (this.role === 'host') {
      if (ready) this.readyIds.add(HOST_ID); else this.readyIds.delete(HOST_ID)
      this.broadcastRoster()
      this.maybeStart()
    } else {
      this.net.broadcast('ready', { ready } satisfies ReadyMsg)
    }
  }

  /** host: готовность соперника-человека (бот авто-готов и сюда не ходит). */
  private onReady(msg: ReadyMsg, from: PeerId) {
    if (from !== this.clientPeer || this.opponent?.kind !== 'human') return
    if (msg.ready) this.readyIds.add(OPPONENT_ID); else this.readyIds.delete(OPPONENT_ID)
    this.broadcastRoster()
    this.maybeStart()
  }

  /** host: оба готовы и слот занят → старт матча. */
  private maybeStart() {
    if (this.role !== 'host' || !this.opponent) return
    if (this.readyIds.has(HOST_ID) && this.readyIds.has(OPPONENT_ID)) this.start()
  }

  /** host: резолв концертных параметров матча от своего выбора и желаемого соперника. */
  private resolveAgainst(clientMap: MapFilter, clientDur: DurationFilter) {
    const r = resolveMatchParams({ map: this.selMap, durationMin: this.selDuration }, { map: clientMap, durationMin: clientDur }, pickRandom, pickRandom)
    this.mapId = r.mapId
    this.durationMin = r.durationMin
    this.selMap = [r.mapId]         // после резолва селект показывает конкретный итог (залочено)
    this.selDuration = [r.durationMin]
  }

  setDuration(mins: DurationFilter) {
    this.selDuration = mins
    if (mins.length) this.durationMin = mins[0]
    if (this.role === 'host') this.broadcastRoster()   // клиент увидит выбор в Assign
    else this.emitChange()                             // клиент: локальный UI; желаемое уедет в Hello
  }

  setMap(maps: MapFilter) {
    this.selMap = maps
    if (maps.length) this.mapId = maps[0]
    if (this.role === 'host') this.broadcastRoster()
    else this.emitChange()
  }

  // --- client ---
  private sayHello() {
    if (this.localPlayerId < 0) {
      const { name, primaryColor, reserveColor, ballModel, windupStyle, respawnStyle, dashStyle, shieldStyle, ballArt } = this.profile
      this.net.broadcast('hello', { name, primaryColor, reserveColor, desiredMap: this.selMap, desiredDuration: this.selDuration, ballModel, windupStyle, respawnStyle, dashStyle, shieldStyle, ballArt } satisfies Hello)
    }
  }
  private onAssign(a: Assign) {
    this.clearTimers()   // подключились — хватит звать HELLO и сторожить хендшейк
    this.localPlayerId = a.yourId
    this.hostEntry = a.roster.find(r => r.id === HOST_ID) ?? this.hostEntry
    this.opponent = a.roster.find(r => r.id === OPPONENT_ID) ?? null
    this.durationMin = a.durationMin
    this.mapId = a.mapId
    this.selMap = [a.mapId]
    this.selDuration = [a.durationMin]
    this.readyIds = new Set(a.ready)
    this.emitChange()
  }

  /** Закрыть сессию: остановить таймеры и выйти из транспорта. */
  dispose() {
    this.disposed = true
    this.clearTimers()
    this.net.leave()
  }

  private clearTimers() {
    if (this.helloTimer) { clearInterval(this.helloTimer); this.helloTimer = null }
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null }
  }

  /** Клиент: хост покинул комнату до старта матча (после старта разрыв ведёт NetSession). */
  private onHostGone() {
    if (this.started || this.disposed) return
    this.clearTimers()
    this.closedCb()
  }

  /** Клиент: ASSIGN не пришёл за отведённое время → считаем коннект неудачным. */
  private onConnectTimeout() {
    this.connectTimer = null
    if (this.localPlayerId >= 0 || this.started || this.disposed) return   // уже подключились/стартовали/закрыто
    this.clearTimers()
    this.closedCb()
  }

  // --- общий API ---
  onChange(cb: (v: RoomView) => void) { this.changeCb = cb; cb(this.view()) }
  onStart(cb: (durationMs: number, mapId: MapId) => void) { this.startCb = cb }
  /** Клиент: сессия закрылась до матча (хост ушёл / таймаут хендшейка). Хосту не приходит. */
  onClosed(cb: () => void) { this.closedCb = cb }
  private emitChange() { this.changeCb(this.view()) }

  /** Ростер матча: ровно `[host, opponent]` (или только host, пока слот пуст). */
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
