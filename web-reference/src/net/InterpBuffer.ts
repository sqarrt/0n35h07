interface Sample { t: number; x: number; y: number; z: number; tick: number }

/**
 * Timestamped position buffer for rendering a remote entity in the PAST (entity interpolation). `sample(renderTime)`
 * returns the position interpolated between the two samples bracketing renderTime — so irregular packet arrival
 * never shows as jitter. Holds the newest when renderTime is ahead of it (no extrapolation); clamps to the oldest
 * when behind. Pure + deterministic (caller supplies the clock).
 */
export class InterpBuffer {
  private buf: Sample[] = []
  private capacity: number
  constructor(capacity: number = 16) { this.capacity = capacity }

  push(t: number, x: number, y: number, z: number, senderTick: number = 0): void {
    this.buf.push({ t, x, y, z, tick: senderTick })
    if (this.buf.length > this.capacity) this.buf.shift()
  }


  get latest(): { x: number; y: number; z: number } | null {
    const s = this.buf[this.buf.length - 1]
    return s ? { x: s.x, y: s.y, z: s.z } : null
  }

  sample(renderTime: number, out: { x: number; y: number; z: number }): boolean {
    if (this.buf.length === 0) return false
    if (renderTime <= this.buf[0].t) { out.x = this.buf[0].x; out.y = this.buf[0].y; out.z = this.buf[0].z; return true }
    const last = this.buf[this.buf.length - 1]
    if (renderTime >= last.t) { out.x = last.x; out.y = last.y; out.z = last.z; return true }
    for (let i = 1; i < this.buf.length; i++) {
      const b = this.buf[i]
      if (renderTime <= b.t) {
        const a = this.buf[i - 1]
        const f = (renderTime - a.t) / (b.t - a.t)   // b.t > a.t guaranteed (monotonic pushes)
        out.x = a.x + (b.x - a.x) * f; out.y = a.y + (b.y - a.y) * f; out.z = a.z + (b.z - a.z) * f
        return true
      }
    }
    out.x = last.x; out.y = last.y; out.z = last.z; return true   // unreachable, but typesafe
  }
}
