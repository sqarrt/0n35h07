import type { INet, PeerId } from './INet'
import type { InputFrame, Snapshot, MatchEvent } from './protocol'
import type { MatchRole } from '../constants'
import { NET_SNAPSHOT_HZ } from '../constants'

/** Узкий контракт Match для сети — позволяет тестировать NetSession без Rapier. */
export interface MatchNet {
  readonly role: MatchRole
  readonly localId: number
  serializeSnapshot(): Snapshot
  drainEvents(): MatchEvent[]
  pushRemoteInput(playerId: number, frame: InputFrame): void
  applySnapshot(snap: Snapshot): void
  applyEvent(e: MatchEvent): void
  localInputFrame(seq: number): InputFrame
}

/**
 * Оркестратор сети поверх транспорта (INet). Входящие сообщения применяются в обработчиках
 * (event-driven), исходящие шлёт `afterUpdate` после шага симуляции:
 *  - host: события матча (надёжно, каждый кадр) + снапшот (троттлинг NET_SNAPSHOT_HZ);
 *  - client: кадр ввода своего игрока (каждый кадр).
 */
export class NetSession {
  private net: INet
  private match: MatchNet
  private peerToPlayer: Map<PeerId, number>
  private seq = 0
  private lastSnapshotAt = 0
  private readonly snapshotInterval = 1000 / NET_SNAPSHOT_HZ

  constructor(net: INet, match: MatchNet, peerToPlayer: Map<PeerId, number>) {
    this.net = net
    this.match = match
    this.peerToPlayer = peerToPlayer

    if (match.role === 'host') {
      net.on('input', (payload, from) => {
        const pid = this.peerToPlayer.get(from)
        if (pid !== undefined) this.match.pushRemoteInput(pid, payload as InputFrame)
      })
    } else if (match.role === 'client') {
      net.on('snapshot', payload => this.match.applySnapshot(payload as Snapshot))
      net.on('event', payload => this.match.applyEvent(payload as MatchEvent))
    }
  }

  /** Отправка исходящего после шага симуляции. */
  afterUpdate(now: number = Date.now()) {
    if (this.match.role === 'host') {
      for (const e of this.match.drainEvents()) this.net.broadcast('event', e)
      if (now - this.lastSnapshotAt >= this.snapshotInterval) {
        this.lastSnapshotAt = now
        this.net.broadcast('snapshot', this.match.serializeSnapshot())
      }
    } else if (this.match.role === 'client') {
      this.net.broadcast('input', this.match.localInputFrame(this.seq++))
    }
  }

  dispose() { this.net.leave() }
}
