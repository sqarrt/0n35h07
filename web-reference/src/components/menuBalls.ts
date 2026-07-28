import type * as THREE from 'three'
import { HOST_ID } from '../constants'
import type { BallModel, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from '../constants'
import type { RosterEntry } from '../net/protocol'
import { STAGE_SPOTS, PLAYER_SPOT } from './menuStage'
import type { MenuMode } from './menuStage'

// ringColor — the "secondary" color (planet ring); *Seq — click counters (one-shot preview triggers).
export interface BallSpec { color: string; model: BallModel; ringColor?: string; windupStyle?: WindupStyle; windupSeq?: number; respawnStyle?: RespawnStyle; respawnSeq?: number; dashStyle?: DashStyle; dashSeq?: number; shieldStyle?: ShieldStyle; shieldSeq?: number; ballArt?: string }
export interface ActiveBall { key: string; spec: BallSpec; spot: THREE.Vector3 }
/** The slice of RoomView the stage needs (kept narrow so units build it by hand). */
export interface StageRoom { roster: RosterEntry[]; localPlayerId: number }

/** Full cosmetic spec from a roster entry: art and the reserve-color ring INCLUDED (their absence on the
 *  lobby backdrop was the old "ballArt disappears in the lobby" bug). */
const specOf = (e: RosterEntry): BallSpec => ({
  color: e.color, model: e.ballModel ?? 'smooth', ringColor: e.reserveColor, ballArt: e.ballArt,
})

/** Who stands on the stage: in a lobby — EVERY occupant on the spot of its slot id; elsewhere — just you.
 *  Your own ball keeps the 'player' key (no re-fade on screen changes) and your live profile ring color. */
export function computeBalls(mode: MenuMode, player: BallSpec, room: StageRoom | null): ActiveBall[] {
  if (mode === 'lobby' && room) {
    // Client pre-ASSIGN: the local roster holds only our own placeholder at seat 0.
    const selfId = room.roster.some(r => r.id === room.localPlayerId) ? room.localPlayerId : HOST_ID
    const balls = room.roster
      .filter(e => STAGE_SPOTS[e.id] !== undefined)
      .map(e => (e.id === selfId
        ? { key: 'player', spec: { ...specOf(e), ringColor: player.ringColor, ballArt: e.ballArt ?? player.ballArt }, spot: STAGE_SPOTS[e.id] }
        : { key: `slot-${e.id}`, spec: specOf(e), spot: STAGE_SPOTS[e.id] }))
    if (balls.length) return balls
  }
  return [{ key: 'player', spec: player, spot: PLAYER_SPOT }]
}
