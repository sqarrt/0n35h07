import type { INet, PeerId, NetHandler, PeerHandler } from './INet'
import type { NetTag } from './protocol'

/**
 * In-process transport for unit tests: linked endpoints in one process, synchronous delivery.
 * Supports a pair (createLoopbackPair) and an N-peer hub where everyone hears everyone
 * (createLoopbackHub). A peer is considered present from the moment the link is created.
 */
export class LoopbackNet implements INet {
  readonly selfId: PeerId
  private links: LoopbackNet[] = []
  private handlers = new Map<NetTag, NetHandler[]>()
  private leaveCbs: PeerHandler[] = []

  constructor(id: PeerId) { this.selfId = id }

  link(peer: LoopbackNet) { if (!this.links.includes(peer)) this.links.push(peer) }

  broadcast(tag: NetTag, payload: unknown) { for (const p of this.links) p.deliver(tag, payload, this.selfId) }
  send(peerId: PeerId, tag: NetTag, payload: unknown) {
    this.links.find(p => p.selfId === peerId)?.deliver(tag, payload, this.selfId)
  }

  private deliver(tag: NetTag, payload: unknown, from: PeerId) {
    (this.handlers.get(tag) ?? []).forEach(cb => cb(payload, from))
  }

  on(tag: NetTag, cb: NetHandler) {
    const list = this.handlers.get(tag) ?? []
    list.push(cb)
    this.handlers.set(tag, list)
  }

  // Peers are present immediately — call cb right away for every established link.
  onPeerJoin(cb: PeerHandler) { for (const p of this.links) cb(p.selfId) }
  onPeerLeave(cb: PeerHandler) { this.leaveCbs.push(cb) }

  /** Test helper: simulate a peer leaving. No argument → every current link (pair compat). */
  triggerLeave(peerId?: PeerId) {
    const ids = peerId !== undefined ? [peerId] : this.links.map(p => p.selfId)
    for (const id of ids) this.leaveCbs.forEach(cb => cb(id))
  }

  peers(): PeerId[] { return this.links.map(p => p.selfId) }
  leave() { this.links = []; this.handlers.clear() }
}

/** Creates a pair of linked loopback endpoints (host + client). */
export function createLoopbackPair(idA = 'host', idB = 'client'): [LoopbackNet, LoopbackNet] {
  const a = new LoopbackNet(idA)
  const b = new LoopbackNet(idB)
  a.link(b)
  b.link(a)
  return [a, b]
}

/** Creates an N-peer hub: every endpoint is linked to every other (synchronous mesh). */
export function createLoopbackHub(ids: PeerId[]): LoopbackNet[] {
  const nets = ids.map(id => new LoopbackNet(id))
  for (const a of nets) for (const b of nets) if (a !== b) a.link(b)
  return nets
}
