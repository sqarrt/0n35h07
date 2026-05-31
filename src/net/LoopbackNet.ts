import type { INet, PeerId, NetHandler, PeerHandler } from './INet'
import type { NetTag } from './protocol'

/**
 * In-process транспорт для юнит-тестов: два связанных эндпоинта в одном процессе,
 * синхронная доставка. Пир считается присутствующим с момента создания пары.
 */
class LoopbackNet implements INet {
  readonly selfId: PeerId
  private peer: LoopbackNet | null = null
  private handlers = new Map<NetTag, NetHandler[]>()

  constructor(id: PeerId) { this.selfId = id }

  link(peer: LoopbackNet) { this.peer = peer }

  broadcast(tag: NetTag, payload: unknown) { this.peer?.deliver(tag, payload, this.selfId) }
  send(peerId: PeerId, tag: NetTag, payload: unknown) {
    if (this.peer && this.peer.selfId === peerId) this.peer.deliver(tag, payload, this.selfId)
  }

  private deliver(tag: NetTag, payload: unknown, from: PeerId) {
    (this.handlers.get(tag) ?? []).forEach(cb => cb(payload, from))
  }

  on(tag: NetTag, cb: NetHandler) {
    const list = this.handlers.get(tag) ?? []
    list.push(cb)
    this.handlers.set(tag, list)
  }

  // Пир присутствует сразу — зовём cb немедленно, если связь уже установлена.
  onPeerJoin(cb: PeerHandler) { if (this.peer) cb(this.peer.selfId) }
  onPeerLeave(_cb: PeerHandler) { /* в loopback пир не уходит */ }

  peers(): PeerId[] { return this.peer ? [this.peer.selfId] : [] }
  leave() { this.peer = null; this.handlers.clear() }
}

/** Создаёт пару связанных loopback-эндпоинтов (хост + клиент). */
export function createLoopbackPair(idA = 'host', idB = 'client'): [INet, INet] {
  const a = new LoopbackNet(idA)
  const b = new LoopbackNet(idB)
  a.link(b)
  b.link(a)
  return [a, b]
}
