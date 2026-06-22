import type { Controller } from '../abstractions'
import type { Player } from '../Player'
import type { World } from '../World'
import { intentsFromInput } from '../../net/input'
import type { InputFrame } from '../../net/protocol'

interface Edges { fire: boolean; shield: boolean; dash: boolean }
const noEdges = (): Edges => ({ fire: false, shield: false, dash: false })

/**
 * Host: drives the remote player's avatar from received InputFrames via the same intent-methods
 * as a human (`intentsFromInput`). Movement/aim come from the freshest frame
 * (extrapolated until a new one arrives), while edge actions (jump/fire/shield/dash)
 * are **accumulated** between steps — otherwise a single frame with `fire` is lost if a fresher
 * frame overwrites it before processing (messages often arrive in batches).
 */
export class RemoteInputController implements Controller {
  private player: Player
  private world: World
  private latest: InputFrame | null = null
  private edges: Edges = noEdges()
  private appliedSeq = 0

  constructor(player: Player, world: World) {
    this.player = player
    this.world = world
  }

  /** Accept a frame: accumulate edge actions (fire/shield/dash); movement/aim/jump(held) — from the newest. */
  enqueue(frame: InputFrame) {
    this.edges.fire   ||= frame.fire
    this.edges.shield ||= frame.shield
    this.edges.dash   ||= frame.dash
    if (!this.latest || frame.seq >= this.latest.seq) this.latest = frame
  }

  update(dt: number) {
    if (!this.latest) return
    this.appliedSeq = this.latest.seq
    intentsFromInput(this.player, { ...this.latest, ...this.edges }, dt, this.world)
    this.edges = noEdges()
  }

  /** Last applied seq — the host puts it in the snapshot (ackSeq) for client reconciliation. */
  get ackSeq() { return this.appliedSeq }
}
