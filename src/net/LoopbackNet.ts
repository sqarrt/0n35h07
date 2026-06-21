import type { INet, PeerId, NetHandler, PeerHandler } from './INet'
import type { NetTag } from './protocol'

/**
 * In-process transport for unit tests: two linked endpoints in one process,
 * synchronous delivery. A peer is considered present from the moment the pair is created.
 */
export class LoopbackNet implements INet {
  readonly selfId: PeerId
  private peer: LoopbackNet | null = null
  private handlers = new Map<NetTag, NetHandler[]>()
  private leaveCbs: PeerHandler[] = []

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

  // Peer is present immediately — call cb right away if the link is already established.
  onPeerJoin(cb: PeerHandler) { if (this.peer) cb(this.peer.selfId) }
  onPeerLeave(cb: PeerHandler) { this.leaveCbs.push(cb) }

  /** Test helper: simulate a peer leaving. */
  triggerLeave() { if (this.peer) this.leaveCbs.forEach(cb => cb(this.peer!.selfId)) }

  peers(): PeerId[] { return this.peer ? [this.peer.selfId] : [] }
  leave() { this.peer = null; this.handlers.clear() }
}

/** Creates a pair of linked loopback endpoints (host + client). */
export function createLoopbackPair(idA = 'host', idB = 'client'): [LoopbackNet, LoopbackNet] {
  const a = new LoopbackNet(idA)
  const b = new LoopbackNet(idB)
  a.link(b)
  b.link(a)
  return [a, b]
}
