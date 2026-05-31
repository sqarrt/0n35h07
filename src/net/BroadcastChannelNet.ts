import type { INet, PeerId, NetHandler, PeerHandler } from './INet'
import type { NetTag } from './protocol'

const PRESENCE_PING_MS    = 1000   // период объявления «я здесь»
const PRESENCE_TIMEOUT_MS = 3500   // без вестей дольше — пир считается ушедшим

type WireKind = 'msg' | 'ping' | 'bye'
interface Wire {
  kind: WireKind
  from: PeerId
  to?:  PeerId       // если задан — адресная отправка
  tag?: NetTag
  data?: unknown
}

/**
 * Транспорт поверх BroadcastChannel: связь между вкладками одного браузера (same-origin).
 * Presence — пинг/таймаут. Используется для локальной игры «в две вкладки» и для e2e
 * (?net=bc) без внешних трекеров. BroadcastChannel НЕ доставляет сообщения самому себе.
 */
export class BroadcastChannelNet implements INet {
  readonly selfId: PeerId
  private ch: BroadcastChannel
  private handlers = new Map<NetTag, NetHandler[]>()
  private joinCbs: PeerHandler[] = []
  private leaveCbs: PeerHandler[] = []
  private seen = new Map<PeerId, number>()   // peerId → lastSeen (ms)
  private pingTimer: ReturnType<typeof setInterval>
  private pruneTimer: ReturnType<typeof setInterval>

  constructor(roomId: string) {
    this.selfId = crypto.randomUUID()
    this.ch = new BroadcastChannel(`oneshot:${roomId}`)
    this.ch.onmessage = (e: MessageEvent<Wire>) => this.receive(e.data)
    this.announce()
    this.pingTimer  = setInterval(() => this.announce(), PRESENCE_PING_MS)
    this.pruneTimer = setInterval(() => this.prune(), PRESENCE_PING_MS)
  }

  private announce() { this.post({ kind: 'ping', from: this.selfId }) }
  private post(w: Wire) { this.ch.postMessage(w) }

  private touch(from: PeerId) {
    if (!this.seen.has(from)) {
      this.seen.set(from, Date.now())
      this.joinCbs.forEach(cb => cb(from))
      this.announce()   // отвечаем, чтобы новичок узнал о нас
    } else {
      this.seen.set(from, Date.now())
    }
  }

  private prune() {
    const now = Date.now()
    for (const [id, last] of this.seen) {
      if (now - last > PRESENCE_TIMEOUT_MS) {
        this.seen.delete(id)
        this.leaveCbs.forEach(cb => cb(id))
      }
    }
  }

  private receive(w: Wire) {
    if (w.from === this.selfId) return
    if (w.kind === 'bye') {
      if (this.seen.delete(w.from)) this.leaveCbs.forEach(cb => cb(w.from))
      return
    }
    this.touch(w.from)
    if (w.kind === 'msg' && w.tag) {
      if (w.to && w.to !== this.selfId) return
      (this.handlers.get(w.tag) ?? []).forEach(cb => cb(w.data, w.from))
    }
  }

  broadcast(tag: NetTag, payload: unknown) { this.post({ kind: 'msg', from: this.selfId, tag, data: payload }) }
  send(peerId: PeerId, tag: NetTag, payload: unknown) {
    this.post({ kind: 'msg', from: this.selfId, to: peerId, tag, data: payload })
  }

  on(tag: NetTag, cb: NetHandler) {
    const list = this.handlers.get(tag) ?? []
    list.push(cb)
    this.handlers.set(tag, list)
  }
  onPeerJoin(cb: PeerHandler)  { this.joinCbs.push(cb) }
  onPeerLeave(cb: PeerHandler) { this.leaveCbs.push(cb) }

  peers(): PeerId[] { return [...this.seen.keys()] }

  leave() {
    this.post({ kind: 'bye', from: this.selfId })
    clearInterval(this.pingTimer)
    clearInterval(this.pruneTimer)
    this.ch.close()
    this.handlers.clear()
    this.seen.clear()
  }
}
