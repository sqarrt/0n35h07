import type { NetTag } from './protocol'

export type PeerId = string
export type NetHandler = (payload: unknown, from: PeerId) => void
export type PeerHandler = (peerId: PeerId) => void

/**
 * Low-level transport: broadcast/directed send by tags + presence.
 * Payload is JSON-serializable (see protocol.ts). Implementations:
 * TrysteroNet (internet P2P), BroadcastChannelNet (tabs/e2e), LoopbackNet (units).
 */
export interface INet {
  readonly selfId: PeerId
  broadcast(tag: NetTag, payload: unknown): void
  send(peerId: PeerId, tag: NetTag, payload: unknown): void
  on(tag: NetTag, cb: NetHandler): void
  onPeerJoin(cb: PeerHandler): void
  onPeerLeave(cb: PeerHandler): void
  peers(): PeerId[]
  leave(): void
}
