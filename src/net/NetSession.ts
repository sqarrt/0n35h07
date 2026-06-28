import type { INet, PeerId } from './INet'
import type { InputFrame, Snapshot, MatchEvent, PhaseMsg } from './protocol'
import type { MatchRole } from '../constants'
import { NET_SNAPSHOT_HZ } from '../constants'

/** Narrow Match contract for networking — lets NetSession be tested without Rapier. */
export interface MatchNet {
  readonly role: MatchRole
  readonly localId: number
  serializeSnapshot(): Snapshot
  drainEvents(): MatchEvent[]
  pushRemoteInput(playerId: number, frame: InputFrame): void
  applySnapshot(snap: Snapshot): void
  applyEvent(e: MatchEvent): void
  localInputFrame(): InputFrame
  markReady(id: number): void
  applyPhase(p: PhaseMsg): void
  serializePhase(): PhaseMsg
  phaseDirty(): boolean
  clearPhaseDirty(): void
  handlePlayerLeft(id: number): void
}

/**
 * Network orchestrator over the transport (INet). Incoming messages are applied in handlers
 * (event-driven), outgoing ones are sent by `afterUpdate` after the simulation step:
 *  - host: match events (reliable, every frame) + snapshot (throttled to NET_SNAPSHOT_HZ);
 *  - client: own player's input frame (every frame).
 */
export class NetSession {
  private net: INet
  private match: MatchNet
  private peerToPlayer: Map<PeerId, number>
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
      net.on('ready', (_payload, from) => {
        const pid = this.peerToPlayer.get(from)
        if (pid !== undefined) this.match.markReady(pid)
      })
    } else if (match.role === 'client') {
      net.on('snapshot', payload => this.match.applySnapshot(payload as Snapshot))
      net.on('event', payload => this.match.applyEvent(payload as MatchEvent))
      net.on('phase', payload => this.match.applyPhase(payload as PhaseMsg))
    }

    net.onPeerLeave(peerId => this.onPeerLeave(peerId))
  }

  /** Disconnect: host knows playerId by peer; for the client, the one who left is the host (id 0). */
  private onPeerLeave(peerId: PeerId) {
    const pid = this.peerToPlayer.get(peerId)
    if (pid !== undefined) this.match.handlePlayerLeft(pid)
    else if (this.match.role === 'client') this.match.handlePlayerLeft(0)
  }

  /** Client announces readiness to the host. */
  sendReady() { this.net.broadcast('ready', {}) }

  /** Send outgoing data after the simulation step. */
  afterUpdate(now: number = Date.now()) {
    if (this.match.role === 'host') {
      if (this.match.phaseDirty()) {
        this.net.broadcast('phase', this.match.serializePhase())
        this.match.clearPhaseDirty()
      }
      for (const e of this.match.drainEvents()) this.net.broadcast('event', e)
      if (now - this.lastSnapshotAt >= this.snapshotInterval) {
        this.lastSnapshotAt = now
        this.net.broadcast('snapshot', this.match.serializeSnapshot())
      }
    } else if (this.match.role === 'client') {
      this.net.broadcast('input', this.match.localInputFrame())
    }
  }

  dispose() { this.net.leave() }
}
