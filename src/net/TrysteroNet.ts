import { joinRoom, selfId } from 'trystero'
import type { MessageAction, DataPayload, JoinRoomConfig } from 'trystero'
import type { INet, PeerId, NetHandler, PeerHandler } from './INet'
import type { NetTag } from './protocol'
import { POOL_NAMESPACE } from './poolNamespace'

// appId разделяет даже ручной вход по коду: несовместимые версия/платформа не подключатся друг к другу.
export const APP_ID = `oneshot-fps-v1:${POOL_NAMESPACE}`

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

  constructor(roomId: string, relayUrls: string[] = [], iceServers: RTCIceServer[] = []) {
    const config: JoinRoomConfig = { appId: APP_ID }
    // Закрепляем подтверждённо живые релеи (проба на входе в меню) — иначе Trystero выбирает фиксированную
    // пятёрку по хешу appId, и при их падении пиры не находят друг друга.
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
 * Прогрев стека Trystero. Первый joinRoom синхронно инициализирует крипто (secp256k1/WASM), WebRTC и
 * nostr-сигналинг (~860мс) → фриз на «Создать комнату». Поднимаем «warmup»-комнату заранее (в простое меню)
 * и сразу выходим — тяжёлая инициализация проходит в фоне, реальное создание комнаты потом мгновенно.
 * Один раз за сессию.
 */
export function warmTrystero(): void {
  if (warmed) return
  warmed = true
  try {
    const room = joinRoom({ appId: APP_ID }, 'warm-' + Math.random().toString(36).slice(2, 8))
    setTimeout(() => { try { room.leave() } catch { /* best-effort */ } }, 300)
  } catch { /* прогрев — best-effort, ошибки игнорируем */ }
}
