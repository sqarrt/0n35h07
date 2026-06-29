interface Frame { tick: number; x: number; y: number; z: number }

/**
 * Per-player ring of recent hitbox positions keyed by the host sim tick. The host uses `at(viewTick)` to rewind a
 * player to where it was at the tick the shooter was rendering (lag compensation), interpolating between recorded
 * ticks. Clamps to the ends; capacity bounds the rewind window (~250 ms at 60 Hz ≈ 16 ticks). Pure.
 */
export class LagCompHistory {
  private buf: Frame[] = []
  private capacity: number
  constructor(capacity: number = 16) { this.capacity = capacity }

  record(tick: number, x: number, y: number, z: number): void {
    this.buf.push({ tick, x, y, z })
    if (this.buf.length > this.capacity) this.buf.shift()
  }

  /** Interpolated position at `tick` → writes `out`, returns true. Clamps to the ends; false if empty. */
  at(tick: number, out: { x: number; y: number; z: number }): boolean {
    if (this.buf.length === 0) return false
    if (tick <= this.buf[0].tick) { out.x = this.buf[0].x; out.y = this.buf[0].y; out.z = this.buf[0].z; return true }
    const last = this.buf[this.buf.length - 1]
    if (tick >= last.tick) { out.x = last.x; out.y = last.y; out.z = last.z; return true }
    for (let i = 1; i < this.buf.length; i++) {
      const b = this.buf[i]
      if (tick <= b.tick) {
        const a = this.buf[i - 1]
        const f = (tick - a.tick) / (b.tick - a.tick)
        out.x = a.x + (b.x - a.x) * f; out.y = a.y + (b.y - a.y) * f; out.z = a.z + (b.z - a.z) * f
        return true
      }
    }
    out.x = last.x; out.y = last.y; out.z = last.z; return true
  }
}
