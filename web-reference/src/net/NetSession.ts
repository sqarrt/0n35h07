import type { INet, PeerId } from './INet'
import type { Snapshot, MatchEvent, PhaseMsg, HitClaim } from './protocol'
import { NET_SNAPSHOT_HZ } from '../constants'
import { gameLog } from '../diag/gameLog'

/** Narrow Match contract for networking — lets NetSession be tested without Rapier. */
export interface MatchNet {
  readonly localId: number
  serializeSnapshot(): Snapshot
  drainEvents(): MatchEvent[]
  drainClaims(): Array<{ to: string; claim: HitClaim }>
  applyPeerSnapshot(from: string, snap: Snapshot): void
  applyPeerEvent(from: string, e: MatchEvent): void
  judgeIncomingClaim(from: string, claim: HitClaim): void
  applyPhase(p: PhaseMsg): void
  serializePhase(): PhaseMsg
  phaseDirty(): boolean
  clearPhaseDirty(): void
  iAmCreator(): boolean
  creatorPeer(): string
  handlePeerLeft(peer: string): void
}

/**
 * Symmetric mesh orchestrator over the transport (INet) — every peer runs the SAME session:
 *  - broadcasts its OWN facts: events every frame, snapshots of its owned players throttled to NET_SNAPSHOT_HZ;
 *  - ships hit claims ADDRESSED to the victim's owner (the judge);
 *  - applies the other peers' snapshots/events with ownership attribution inside Match;
 *  - only the lobby creator broadcasts phase stamps (ready→countdown).
 */
export class NetSession {
  private net: INet
  private match: MatchNet
  private lastSnapshotAt = 0
  private readonly snapshotInterval = 1000 / NET_SNAPSHOT_HZ

  constructor(net: INet, match: MatchNet) {
    this.net = net
    this.match = match

    net.on('snapshot', (payload, from) => this.match.applyPeerSnapshot(from, payload as Snapshot))
    net.on('event', (payload, from) => this.match.applyPeerEvent(from, payload as MatchEvent))
    net.on('hit', (payload, from) => this.match.judgeIncomingClaim(from, payload as HitClaim))
    net.on('phase', (payload, from) => {
      if (from !== this.match.creatorPeer()) { gameLog.warn('phase', 'phase_drop', { from }); return }
      this.match.applyPhase(payload as PhaseMsg)
    })
    net.onPeerLeave(peerId => this.onPeerLeave(peerId))
  }

  /** Disconnect: every player owned by the vanished peer leaves (bots go down with their owner). */
  private onPeerLeave(peerId: PeerId) {
    gameLog.warn('transport', 'peer_left', { peer: peerId })
    this.match.handlePeerLeft(peerId)
  }

  /** Send outgoing data after the simulation step. */
  afterUpdate(now: number = Date.now()) {
    if (this.match.phaseDirty()) {
      if (this.match.iAmCreator()) this.net.broadcast('phase', this.match.serializePhase())
      this.match.clearPhaseDirty()   // non-creators keep the flag local (their phase comes from the creator)
    }
    for (const e of this.match.drainEvents()) this.net.broadcast('event', e)
    for (const { to, claim } of this.match.drainClaims()) this.net.send(to, 'hit', claim)
    if (now - this.lastSnapshotAt >= this.snapshotInterval) {
      this.lastSnapshotAt = now
      this.net.broadcast('snapshot', this.match.serializeSnapshot())
    }
  }

  dispose() { this.net.leave() }
}
