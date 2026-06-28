import { NET_RECONCILE_SNAP_DIST, NET_PREDICTION_BUFFER } from '../constants'

export interface XYZ { x: number; y: number; z: number }
interface Sample { seq: number; x: number; y: number; z: number }

/**
 * Client-side prediction reconciliation against host snapshots.
 *
 * The client predicts its own player locally (KCC) and records the committed position per input `seq`.
 * Each snapshot carries `ackSeq` — the last input the host actually applied. We compare the host's
 * authoritative position at `ackSeq` against what WE predicted for that same seq:
 *   - within the deadzone → prediction is trustworthy → ZERO correction (no latency injected);
 *   - beyond it → a real divergence (knockback mismatch, dropped input, drift) → return the delta to snap.
 *
 * This replaces the old unconditional per-frame lerp toward an RTT-stale target, which injected the full
 * round-trip latency into the locally predicted position (sticky walk + inertia after key release).
 */
export class ClientReconciler {
  private history: Sample[] = []
  private readonly snapDist: number
  private readonly capacity: number

  constructor(snapDist: number = NET_RECONCILE_SNAP_DIST, capacity: number = NET_PREDICTION_BUFFER) {
    this.snapDist = snapDist
    this.capacity = capacity
  }

  /** Record the committed predicted position for the frame that produced input `seq`. */
  record(seq: number, pos: XYZ) {
    this.history.push({ seq, x: pos.x, y: pos.y, z: pos.z })
    if (this.history.length > this.capacity) this.history.shift()
  }

  /**
   * Correction to ADD to the current position. `{0,0,0}` when the prediction for `ackSeq` is within the
   * deadzone (or that seq is unknown). Prunes history older than `ackSeq`.
   */
  reconcile(ackSeq: number, authority: XYZ): XYZ {
    if (ackSeq <= 0) return { x: 0, y: 0, z: 0 }   // host hasn't applied any of our input yet (appliedSeq sentinel)
    const idx = this.history.findIndex(s => s.seq === ackSeq)
    if (idx < 0) return { x: 0, y: 0, z: 0 }
    const predicted = this.history[idx]
    const dx = authority.x - predicted.x
    const dy = authority.y - predicted.y
    const dz = authority.z - predicted.z
    this.history.splice(0, idx)   // drop everything older than the acked seq
    if (dx * dx + dy * dy + dz * dz < this.snapDist * this.snapDist) return { x: 0, y: 0, z: 0 }
    // Rebase the still-in-flight predictions (seq ≥ ackSeq) into the corrected frame. The same offset will
    // appear on every later acked seq (the host's authority carries it forward); without this rebase each one
    // re-returns the full delta, so over a multi-frame in-flight window the corrections COMPOUND and the client
    // overshoots — thrash / flung off the map. After rebasing, only genuinely NEW divergence corrects again.
    for (const s of this.history) { s.x += dx; s.y += dy; s.z += dz }
    return { x: dx, y: dy, z: dz }
  }

  /** Respawn/teleport: old predictions are invalid. */
  reset() { this.history.length = 0 }
}
