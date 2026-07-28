import * as THREE from 'three'
import type { ISfxEngine } from './types'
import type { MatchEvent } from '../../../net/protocol'
import type { WindupStyle } from '../../../constants'
import { windupSfxEvent } from './windupSfx'

export type MoveKind = 'jump' | 'land'

// Throttle movement sounds (jump/land) per player: in auto-bhop landing and liftoff come as a pair ~16ms
// apart → overlapping short transients give a "fart". Collapse into one hit per bounce; ordinary
// jumps (airtime > this interval) are unaffected.
const MOVE_SFX_THROTTLE_MS = 100

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** Per-frame snapshot of player state for diffing transitions. */
export interface PlayerSfxInput {
  id: number
  obj: THREE.Object3D
  pos: THREE.Vector3
  shieldActive: boolean
  dashing: boolean
  grounded: boolean | null      // null = unknown (remote on client) → jump/land arrive as an event
  justJumped: boolean
  dashReady: boolean | null     // non-null only for the local player (cooldown_ready)
  shieldReady: boolean | null
  windingUp: boolean            // beam windup in progress (for beam_fire — sound starts at windup START)
  windupStyle?: WindupStyle     // windup animation style (sound); none → classic
  isLocal: boolean              // own player → 2D sounds (come "from you"); opponent → positional (audible direction)
}

interface PrevState { shield: boolean; dashing: boolean; grounded: boolean | null; dashReady: boolean; shieldReady: boolean; windingUp: boolean }

/** Match SFX trigger logic. The single place for "event/transition → sound" rules. */
export class MatchSfx {
  private engine: ISfxEngine
  private prev = new Map<number, PrevState>()
  private lastMoveSfx = new Map<number, number>()   // id → time of last jump/land (throttle)
  constructor(engine: ISfxEngine) { this.engine = engine }

  /** Can a player's movement sound play now (no more often than MOVE_SFX_THROTTLE_MS). */
  private moveSfxOk(id: number, now: number): boolean {
    return now - (this.lastMoveSfx.get(id) ?? -Infinity) >= MOVE_SFX_THROTTLE_MS
  }

  /** Combat — from the shared event path (host: emit; client: applyEvent). posOf gives a player's world position.
   *  beam_fire is NOT played here: its sound is the whole shot (windup→discharge), starting at windup start
   *  (see frame), otherwise the discharge lags by the windup length. block/kill/respawn — instant, per event. */
  combat(e: MatchEvent, posOf: (id: number) => THREE.Vector3 | null): void {
    switch (e.t) {
      case 'block':   { const p = posOf(e.victim); if (p) this.engine.playAt('block', p);     break }
      case 'kill':    { const p = posOf(e.victim); if (p) this.engine.playAt('death', p);      break }
      case 'respawn': { this.engine.playAt('respawn', new THREE.Vector3(e.pos[0], e.pos[1], e.pos[2])); break }
      default: break
    }
  }

  /** Per-frame state diff: windup/shield/dash/jump/land/cooldown. Returns moves to emit (host). */
  frame(inputs: PlayerSfxInput[], now: number = nowMs()): { id: number; kind: MoveKind; pos: THREE.Vector3 }[] {
    const moves: { id: number; kind: MoveKind; pos: THREE.Vector3 }[] = []
    for (const inp of inputs) {
      const prev = this.prev.get(inp.id)
      // Own player: source coincides with the listener (camera) → panner degenerates, glitch. So own → 2D.
      const playEv = inp.isLocal
        ? (ev: Parameters<ISfxEngine['play2D']>[0]) => this.engine.play2D(ev)
        : (ev: Parameters<ISfxEngine['play2D']>[0]) => this.engine.playAt(ev, inp.pos)
      if (inp.windingUp && !(prev?.windingUp)) playEv(windupSfxEvent(inp.windupStyle, this.engine))   // whole-shot sound — from windup start
      if (inp.shieldActive && !(prev?.shield)) {
        playEv('shield_up')
        this.engine.startLoop('shield_loop', `shield:${inp.id}`, inp.isLocal ? null : inp.obj)
      } else if (!inp.shieldActive && prev?.shield) {
        playEv('shield_down')
        this.engine.stopLoop(`shield:${inp.id}`)
      }
      if (inp.dashing && !(prev?.dashing)) playEv('dash')
      // Jump has no sound (by request) — only landing. Per-player throttle against frequent land retriggers.
      if (inp.grounded === true && prev?.grounded === false && this.moveSfxOk(inp.id, now)) {
        playEv('land'); moves.push({ id: inp.id, kind: 'land', pos: inp.pos.clone() })
        this.lastMoveSfx.set(inp.id, now)
      }
      if (inp.dashReady !== null && inp.shieldReady !== null && prev) {
        if ((inp.dashReady && !prev.dashReady) || (inp.shieldReady && !prev.shieldReady)) this.engine.play2D('cooldown_ready')
      }
      this.prev.set(inp.id, {
        shield: inp.shieldActive, dashing: inp.dashing, grounded: inp.grounded,
        dashReady: inp.dashReady ?? true, shieldReady: inp.shieldReady ?? true, windingUp: inp.windingUp,
      })
    }
    return moves
  }

  /** Opponent jump/landing (client, move event) — positional. */
  move(kind: MoveKind, pos: THREE.Vector3): void { this.engine.playAt(kind, pos) }

  /** Non-positional match sound (countdown). */
  play2D(event: Parameters<ISfxEngine['play2D']>[0]): void { this.engine.play2D(event) }

  /** Clear loops/state (match end). */
  reset(): void {
    for (const id of this.prev.keys()) this.engine.stopLoop(`shield:${id}`)
    this.prev.clear()
    this.lastMoveSfx.clear()
  }
}
