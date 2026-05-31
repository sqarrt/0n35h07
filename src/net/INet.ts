import type { NetTag } from './protocol'

export type PeerId = string
export type NetHandler = (payload: unknown, from: PeerId) => void
export type PeerHandler = (peerId: PeerId) => void

/**
 * Низкоуровневый транспорт: рассылка/адресная отправка по тегам + presence.
 * Полезная нагрузка — JSON-сериализуемая (см. protocol.ts). Реализации:
 * TrysteroNet (интернет-P2P), BroadcastChannelNet (вкладки/e2e), LoopbackNet (юниты).
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
