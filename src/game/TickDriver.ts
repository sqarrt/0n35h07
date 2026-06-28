import { FIXED_DT, MAX_FRAME_DT, MAX_CATCHUP_STEPS } from '../constants'

/**
 * Turns a variable real-frame dt into whole fixed-timestep ticks plus a fractional render alpha.
 * Pure + deterministic (no clocks) → unit-testable. The sim runs `ticks` steps of FIXED_DT this frame;
 * the renderer interpolates visuals by `alpha ∈ [0,1)` between the previous and current tick.
 */
export class TickDriver {
  private acc = 0
  private _alpha = 0

  advance(realDt: number): { ticks: number; alpha: number } {
    this.acc += Math.min(realDt, MAX_FRAME_DT)   // clamp a spike before it floods the accumulator
    let ticks = 0
    while (this.acc >= FIXED_DT && ticks < MAX_CATCHUP_STEPS) { this.acc -= FIXED_DT; ticks++ }
    if (this.acc >= FIXED_DT) this.acc = this.acc % FIXED_DT   // hit the cap → shed the backlog (no spiral-of-death)
    this._alpha = this.acc / FIXED_DT
    return { ticks, alpha: this._alpha }
  }

  get alpha(): number { return this._alpha }
}
