import type { INet, PeerId, NetHandler, PeerHandler } from './INet'
import type { NetTag } from './protocol'
import type { SteamNetEvent } from '../steam/steam'

/** The minimal Steam plumbing SteamNet needs — injected so the transport is testable without Tauri. */
export interface SteamNetTransport {
  send(to: PeerId, data: string): void
  leave(): void
}

// Wire envelope: the same {tag, payload} shape the other transports carry, JSON-encoded into the
// single string a Steam NetworkingMessages packet delivers.
interface Envelope { tag: NetTag; data: unknown }

/**
 * INet over Steam: peers are the other lobby members; messages go via NetworkingMessages (SDR,
 * reliable). Lobby lifecycle (create/join/invite) is driven by the lobby controller; this class
 * is purely the transport — it tracks peers from the event stream and routes messages by tag.
 * Mesh: broadcast fans out point-to-point to every lobby member (Steam messages have no true broadcast).
 */
export class SteamNet implements INet {
  readonly selfId: PeerId
  private transport: SteamNetTransport
  private handlers = new Map<NetTag, NetHandler[]>()
  private joinCbs: PeerHandler[] = []
  private leaveCbs: PeerHandler[] = []
  private peerSet = new Set<PeerId>()
  private unlisten: (() => void) | null = null

  constructor(selfId: PeerId, transport: SteamNetTransport) {
    this.selfId = selfId
    this.transport = transport
  }

  /** Feed a raw steam-net event (wired from the Tauri listener; called directly in tests). */
  handleEvent(e: SteamNetEvent): void {
    switch (e.kind) {
      case 'lobbyEntered':
        this.peerSet.clear()
        for (const m of e.members) if (m !== this.selfId) this.addPeer(m)
        break
      case 'peerJoin':
        if (e.steamId !== this.selfId) this.addPeer(e.steamId)
        break
      case 'peerLeave':
        this.removePeer(e.steamId)
        break
      case 'message': {
        if (e.from === this.selfId) break   // never deliver our own packet to ourselves
        let env: Envelope
        try { env = JSON.parse(e.data) as Envelope } catch { break }   // ignore malformed
        ;(this.handlers.get(env.tag) ?? []).forEach(cb => cb(env.data, e.from))
        break
      }
      // 'joinRequested' is handled by the lobby controller (entry flow), not the transport.
    }
  }

  /** Set by createSteamNet so leave() can detach the Tauri listener. */
  setUnlisten(fn: () => void): void { this.unlisten = fn }

  private addPeer(id: PeerId): void {
    if (this.peerSet.has(id)) return
    this.peerSet.add(id)
    this.joinCbs.forEach(cb => cb(id))
  }
  private removePeer(id: PeerId): void {
    if (this.peerSet.delete(id)) this.leaveCbs.forEach(cb => cb(id))
  }

  broadcast(tag: NetTag, payload: unknown): void {
    const data = JSON.stringify({ tag, data: payload })
    for (const p of this.peerSet) this.transport.send(p, data)
  }
  send(peerId: PeerId, tag: NetTag, payload: unknown): void {
    this.transport.send(peerId, JSON.stringify({ tag, data: payload }))
  }

  on(tag: NetTag, cb: NetHandler): void {
    const list = this.handlers.get(tag) ?? []
    list.push(cb)
    this.handlers.set(tag, list)
  }
  onPeerJoin(cb: PeerHandler): void { this.joinCbs.push(cb) }
  onPeerLeave(cb: PeerHandler): void { this.leaveCbs.push(cb) }

  peers(): PeerId[] { return [...this.peerSet] }

  leave(): void {
    this.transport.leave()
    this.unlisten?.()
    this.unlisten = null
    this.handlers.clear()
    this.peerSet.clear()
  }
}
