import { joinRoom, selfId } from 'trystero'
import type { MessageAction, DataPayload, JoinRoomConfig } from 'trystero'
import type { INet, PeerId, NetHandler, PeerHandler } from './INet'
import type { NetTag } from './protocol'

const APP_ID = 'oneshot-fps-v1'

interface Channel { action: MessageAction<DataPayload>; handlers: NetHandler[] }

/**
 * Транспорт поверх Trystero (WebRTC через публичные трекеры Nostr — serverless P2P).
 * Один action на тег (имена ≤12 байт). STUN по умолчанию; iceServers (TURN) идут в rtcConfig
 * для мобильных/симметричных NAT. onPeerJoin/Leave у Trystero — присваиваемые свойства (один
 * обработчик), поэтому мультиплексируем через свои списки.
 */
export class TrysteroNet implements INet {
  readonly selfId: PeerId = selfId
  private room: ReturnType<typeof joinRoom>
  private channels = new Map<NetTag, Channel>()
  private joinCbs: PeerHandler[] = []
  private leaveCbs: PeerHandler[] = []

  constructor(roomId: string, iceServers: RTCIceServer[] = []) {
    const config: JoinRoomConfig = { appId: APP_ID }
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
