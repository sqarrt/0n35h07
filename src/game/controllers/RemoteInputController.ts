import type { Controller } from '../abstractions'
import type { Player } from '../Player'
import type { World } from '../World'
import { applyInputMovement, applyInputAim } from '../../net/input'
import type { InputFrame } from '../../net/protocol'
import { FIXED_DT } from '../../constants'

interface Edges { fire: boolean; shield: boolean; dash: boolean }
const noEdges = (): Edges => ({ fire: false, shield: false, dash: false })

const MAX_QUEUE = 8   // jitter buffer cap: drop the oldest beyond this so a backlog can't grow latency unboundedly

/**
 * Host: drives the remote player's avatar from received InputFrames, TICK-ALIGNED. Both sides run the fixed 60 Hz
 * tick, so the host applies ONE client input per host tick (FIFO, in order) — the natural 1:1 mapping. The
 * last-applied client tick is reported as `ackTick` and echoed in the snapshot for the client's prediction
 * reconciliation. Edge actions (fire/shield/dash) are accumulated so a one-shot isn't lost between frames; on a
 * network gap the last frame's movement is re-applied (extrapolation) so the avatar keeps gliding.
 */
export class RemoteInputController implements Controller {
  private player: Player
  private world: World
  private queue: InputFrame[] = []     // received frames not yet applied (FIFO by tick)
  private last: InputFrame | null = null // newest frame seen — re-applied on a gap
  private edges: Edges = noEdges()
  private appliedTick = 0
  private _lastViewTick = 0   // viewTick of the most recently applied FIRE input (for the host's lag-comp rewind)

  constructor(player: Player, world: World) {
    this.player = player
    this.world = world
  }

  /** Accept a frame: accumulate edges; queue it if it's newer than what we've seen. */
  enqueue(frame: InputFrame) {
    this.edges.fire   ||= frame.fire
    this.edges.shield ||= frame.shield
    this.edges.dash   ||= frame.dash
    if (!this.last || frame.tick > this.last.tick) { this.queue.push(frame); this.last = frame }
  }

  update(_dt: number) {
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE) // bound the backlog
    const frame = this.queue.shift()
    if (!frame) {
      if (this.last) applyInputMovement(this.player, this.last, FIXED_DT) // gap → extrapolate movement, no edges
      return
    }
    applyInputMovement(this.player, frame, FIXED_DT)
    this.appliedTick = frame.tick
    if ((this.edges.fire || frame.fire) && frame.viewTick) this._lastViewTick = frame.viewTick   // remember for lag-comp
    applyInputAim(this.player, { ...frame, ...this.edges }, this.world) // aim + accumulated edge actions, once
    this.edges = noEdges()
  }

  /** Last applied client tick — the host puts it in the snapshot (ackTick) for client reconciliation. */
  get ackTick() { return this.appliedTick }

  /** viewTick of the latest applied fire — the host rewinds the victim to it for hit validation (lag-comp). */
  get lastViewTick() { return this._lastViewTick }
}
