import type { INet, NetHandler, PeerHandler, PeerId } from './INet'
import type { NetTag } from './protocol'

/**
 * Wraps any INet and delays message traffic both directions by `lagMs ± jitterMs` — DEV/e2e only, to reproduce
 * real network latency (the ~0-RTT test transport is exactly what hides prediction/interpolation bugs). Presence
 * (selfId/peers/join/leave) passes through immediately. Uses setTimeout → deterministic under fake timers.
 */
export class LagNet implements INet {
  private inner: INet
  private lagMs: number
  private jitterMs: number
  constructor(inner: INet, lagMs: number, jitterMs: number) {
    this.inner = inner
    this.lagMs = lagMs
    this.jitterMs = jitterMs
  }

  get selfId(): PeerId { return this.inner.selfId }

  private delay(): number {
    const j = this.jitterMs > 0 ? this.jitterMs * (2 * pseudo() - 1) : 0   // ± jitter
    return Math.max(0, this.lagMs + j)
  }

  broadcast(tag: NetTag, payload: unknown): void {
    const inner = this.inner
    setTimeout(() => inner.broadcast(tag, payload), this.delay())
  }
  send(peerId: PeerId, tag: NetTag, payload: unknown): void {
    const inner = this.inner
    setTimeout(() => inner.send(peerId, tag, payload), this.delay())
  }
  on(tag: NetTag, cb: NetHandler): void {
    this.inner.on(tag, (payload, from) => { setTimeout(() => cb(payload, from), this.delay()) })
  }
  onPeerJoin(cb: PeerHandler): void { this.inner.onPeerJoin(cb) }
  onPeerLeave(cb: PeerHandler): void { this.inner.onPeerLeave(cb) }
  peers(): PeerId[] { return this.inner.peers() }
  leave(): void { this.inner.leave() }
}

// Deterministic LCG — avoids Math.random (banned in sim code, and we want reproducible jitter in tests).
let _seed = 1
function pseudo(): number { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff }
