import type { Controller } from '../abstractions'
import type { Player } from '../Player'
import type { World } from '../World'
import { applyInputMovement, applyInputAim } from '../../net/input'
import type { InputFrame } from '../../net/protocol'

interface Edges { fire: boolean; shield: boolean; dash: boolean }
const noEdges = (): Edges => ({ fire: false, shield: false, dash: false })

const NOMINAL_DT = 1 / 60     // fallback when a frame carries no dt (legacy client) — the common frame time
const MAX_CATCHUP = 8         // most queued frames replayed in ONE host update — bounds a backlog so it can't fling the avatar
/** Frame dt is client-supplied → clamp it: drop non-positive / spike values, default the unknown. */
const clampDt = (dt: number | undefined) => (typeof dt === 'number' && dt > 0 && dt <= 0.1 ? dt : NOMINAL_DT)

/**
 * Host: drives the remote player's avatar from received InputFrames via the same intent-methods as a human.
 *
 * Movement is REPLAYED frame-for-frame: every input frame queued since the last update is applied in order with
 * its OWN dt, so the host covers exactly the horizontal distance the client predicted — even when the network
 * delivers frames in bursts (WebRTC batches), and regardless of either side's frame rate. Collapsing a burst to
 * just the newest frame (the old behaviour) silently dropped the in-between movement, so the host's authority
 * lagged the client's prediction and the client got yanked backwards every snapshot (rubber-banding).
 *
 * Aim + edge actions (fire/shield/dash) are applied ONCE per update from the freshest frame (edges accumulated,
 * so a one-shot isn't lost when a fresher frame overwrites it). On a network gap (no new frame) the last frame's
 * movement is re-applied (extrapolation) so the avatar keeps gliding smoothly instead of stuttering.
 */
export class RemoteInputController implements Controller {
  private player: Player
  private world: World
  private queue: InputFrame[] = []     // frames received since the last update, applied in seq order
  private last: InputFrame | null = null // newest frame seen — re-applied (extrapolated) during a gap
  private edges: Edges = noEdges()
  private appliedSeq = 0

  constructor(player: Player, world: World) {
    this.player = player
    this.world = world
  }

  /** Accept a frame: accumulate edge actions; queue its movement if it's newer than what we've seen. */
  enqueue(frame: InputFrame) {
    this.edges.fire   ||= frame.fire
    this.edges.shield ||= frame.shield
    this.edges.dash   ||= frame.dash
    if (!this.last || frame.seq > this.last.seq) { this.queue.push(frame); this.last = frame }
    // else: stale/duplicate frame — its movement is already in the past; only its edges (above) are kept
  }

  update(_dt: number) {
    if (this.queue.length === 0) {
      if (this.last) applyInputMovement(this.player, this.last, clampDt(this.last.dt)) // gap → extrapolate, no edges
      return
    }
    if (this.queue.length > MAX_CATCHUP) this.queue.splice(0, this.queue.length - MAX_CATCHUP) // bound catch-up
    for (const f of this.queue) applyInputMovement(this.player, f, clampDt(f.dt))   // replay every frame's movement
    this.appliedSeq = this.last!.seq
    applyInputAim(this.player, { ...this.last!, ...this.edges }, this.world)        // aim + edges once, from the newest
    this.edges = noEdges()
    this.queue.length = 0
  }

  /** Last applied seq — the host puts it in the snapshot (ackSeq) for client reconciliation. */
  get ackSeq() { return this.appliedSeq }
}
