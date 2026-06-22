import { joinRoom, selfId } from 'trystero'
import type { MessageAction, DataPayload, JoinRoomConfig } from 'trystero'
import type { INet, PeerId, NetHandler, PeerHandler } from './INet'
import type { NetTag } from './protocol'
import { POOL_NAMESPACE } from './poolNamespace'

// appId separates even manual code entry: incompatible version/platform won't connect to each other.
export const APP_ID = `oneshot-fps-v1:${POOL_NAMESPACE}`

interface Channel { action: MessageAction<DataPayload>; handlers: NetHandler[] }

/**
 * Transport over Trystero (WebRTC via public Nostr trackers — serverless P2P).
 * One action per tag (names ≤12 bytes). STUN by default; iceServers (TURN) go into rtcConfig
 * for mobile/symmetric NAT. Trystero's onPeerJoin/Leave are assignable properties (a single
 * handler), so we multiplex through our own lists.
 */
export class TrysteroNet implements INet {
  readonly selfId: PeerId = selfId
  private room: ReturnType<typeof joinRoom>
  private channels = new Map<NetTag, Channel>()
  private joinCbs: PeerHandler[] = []
  private leaveCbs: PeerHandler[] = []

  constructor(roomId: string, relayUrls: string[] = [], iceServers: RTCIceServer[] = []) {
    const config: JoinRoomConfig = { appId: APP_ID }
    // Pin relays confirmed alive (probed on menu entry) — otherwise Trystero picks a fixed
    // five by appId hash, and if those go down peers can't find each other.
    if (relayUrls.length) config.relayConfig = { urls: relayUrls }
    if (iceServers.length) config.rtcConfig = { iceServers }
    this.room = joinRoom(config, roomId)
    this.room.onPeerJoin = id => this.joinCbs.forEach(cb => cb(id))
    this.room.onPeerLeave = id => this.leaveCbs.forEach(cb => cb(id))
  }

  private channel(tag: NetTag): Channel {
    let c = this.channels.get(tag)
    if (!c) {
      const action = this.room.makeAction(tag)
      const ch: Channel = { action, handlers: [] }
      action.onMessage = (data, ctx) => ch.handlers.forEach(h => h(data, ctx.peerId))
      this.channels.set(tag, ch)
      c = ch
    }
    return c
  }

  broadcast(tag: NetTag, payload: unknown) {
    void this.channel(tag).action.send(payload as DataPayload)
  }
  send(peerId: PeerId, tag: NetTag, payload: unknown) {
    void this.channel(tag).action.send(payload as DataPayload, { target: peerId })
  }
  on(tag: NetTag, cb: NetHandler) { this.channel(tag).handlers.push(cb) }
  onPeerJoin(cb: PeerHandler) { this.joinCbs.push(cb) }
  onPeerLeave(cb: PeerHandler) { this.leaveCbs.push(cb) }
  peers(): PeerId[] { return Object.keys(this.room.getPeers()) }
  leave() { void this.room.leave() }
}

let warmed = false
/**
 * Warm up the Trystero stack. The first joinRoom synchronously initializes crypto (secp256k1/WASM), WebRTC and
 * nostr signaling (~860ms) → a freeze on "Create room". We bring up a "warmup" room ahead of time (while the menu
 * is idle) and immediately leave — the heavy init runs in the background, so real room creation is instant later.
 * Once per session.
 */
export function warmTrystero(): void {
  if (warmed) return
  warmed = true
  try {
    const room = joinRoom({ appId: APP_ID }, 'warm-' + Math.random().toString(36).slice(2, 8))
    setTimeout(() => { try { room.leave() } catch { /* best-effort */ } }, 300)
  } catch { /* warmup is best-effort, ignore errors */ }
}
