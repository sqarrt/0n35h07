import { NET_PREDICTION_BUFFER } from '../constants'
import type { BodyState } from '../game/Body'
import type { InputFrame } from './protocol'

interface Sample { tick: number; input: InputFrame; state: BodyState }
export type Decision = { kind: 'trust' } | { kind: 'replay'; from: BodyState; inputs: InputFrame[] }

/**
 * Client-side prediction log. Records (tick → input, post-step BodyState). On a snapshot, compares the host
 * authority at `ackTick` against our prediction there: within `eps` → trust; beyond → REPLAY the unacknowledged
 * inputs from the authoritative state. Full replay (not a one-shot snap) → no residual error, no compounding.
 */
export class PredictionLog {
  private history: Sample[] = []
  private capacity: number
  constructor(capacity: number = NET_PREDICTION_BUFFER) { this.capacity = capacity }

  record(tick: number, input: InputFrame, state: BodyState): void {
    this.history.push({ tick, input, state })
    if (this.history.length > this.capacity) this.history.shift()
  }

  /** Decide what to do given the host's authoritative state at `ackTick`. Prunes the log up to & including ackTick. */
  decide(ackTick: number, authority: BodyState, eps: number): Decision {
    if (ackTick <= 0) return { kind: 'trust' }
    const idx = this.history.findIndex(s => s.tick === ackTick)
    if (idx < 0) return { kind: 'trust' }                          // we don't have that tick (too old / pruned)
    const predicted = this.history[idx].state.pos
    const dx = authority.pos[0] - predicted[0], dy = authority.pos[1] - predicted[1], dz = authority.pos[2] - predicted[2]
    const inputs = this.history.slice(idx + 1).map(s => s.input)   // unacked inputs, in order
    this.history.splice(0, idx + 1)                                 // prune ≤ ackTick
    if (dx * dx + dy * dy + dz * dz <= eps * eps) return { kind: 'trust' }
    return { kind: 'replay', from: authority, inputs }
  }

  reset(): void { this.history.length = 0 }
}
