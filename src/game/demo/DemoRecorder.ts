/**
 * Demo recording: each frame captures the FULL absolute state (camera + players' render state +
 * score/timer/streaks/phase) + transient events (via the Match.emit hook). Frames are independent (see demoTypes).
 * Dev tool: hooks into Match (`match.recorder`), on stop returns a DemoFile for download.
 */
import type * as THREE from 'three'
import type { Match } from '../Match'
import type { MatchEvent, RosterEntry } from '../../net/protocol'
import type { MapId } from '../../constants'
import { DEMO_VERSION } from './demoTypes'
import type { DemoFile, DemoFrame, DemoPlayerState } from './demoTypes'

const CAPTURE_INTERVAL_MS = 1000 / 30   // 30 fps — size/smoothness tradeoff (replay interpolates)

const r3 = (n: number) => Math.round(n * 1000) / 1000
const v3 = (v: THREE.Vector3): [number, number, number] => [r3(v.x), r3(v.y), r3(v.z)]

export class DemoRecorder {
  private frames: DemoFrame[] = []
  private pending: MatchEvent[] = []      // events accumulated since the last frame capture
  private tMs = 0
  private lastPushMs = -Infinity
  private readonly roster: RosterEntry[]
  private readonly mapId: MapId
  private readonly durationMs: number
  private readonly localId: number
  private readonly reserveColor: string

  constructor(meta: { roster: RosterEntry[]; mapId: MapId; durationMs: number; localId: number }) {
    this.roster = meta.roster
    this.mapId = meta.mapId
    this.durationMs = meta.durationMs
    this.localId = meta.localId
    const me = meta.roster.find(r => r.id === meta.localId)
    this.reserveColor = me?.reserveColor ?? me?.color ?? ''   // '' never happens (the local id is always in the roster)
  }

  /** Match.emit hook — accumulate the current frame's transient FX (cloned, so the network layer can't affect them). */
  event(e: MatchEvent): void {
    this.pending.push(JSON.parse(JSON.stringify(e)) as MatchEvent)
  }

  /** Called at the end of the game frame. Throttled to 30fps; events aren't lost (accumulated in pending). */
  capture(match: Match, camera: THREE.PerspectiveCamera, dt: number): void {
    this.tMs += dt * 1000
    if (this.tMs - this.lastPushMs < CAPTURE_INTERVAL_MS) return
    this.lastPushMs = this.tMs

    const snap = match.serializeSnapshot()
    const players: DemoPlayerState[] = snap.players.map((s, i) => {
      const p = match.players[i]
      return {
        id: s.id,
        pos: [r3(s.pos[0]), r3(s.pos[1]), r3(s.pos[2])],
        aimDir: [r3(s.aimDir[0]), r3(s.aimDir[1]), r3(s.aimDir[2])],
        alive: s.alive,
        shieldActive: s.shieldActive,
        dashing: s.dashing,
        windupProgress: r3(s.windupProgress),
        respawning: s.respawning,
        bodyVisible: p ? p.bodyIsVisible : true,
        kills: p ? p.kills : 0,
        deaths: p ? p.deaths : 0,
        streakCount: p ? p.streak : 0,
        beamCooldown: p ? r3(p.beamCooldownProgress()) : 1,
        dashCooldown: p ? r3(p.dashCooldownProgress()) : 1,
        shieldProgress: p ? r3(p.shieldProgress()) : 0,
        respawnProgress: p ? r3(p.respawnProgress()) : 0,
      }
    })

    const cam = camera
    this.frames.push({
      tMs: Math.round(this.tMs),
      cam: { p: v3(cam.position), q: [r3(cam.quaternion.x), r3(cam.quaternion.y), r3(cam.quaternion.z), r3(cam.quaternion.w)], fov: r3(cam.fov) },
      players,
      remainingMs: Math.round(match.getRemainingMs()),
      phase: match.phase,
      events: this.pending,
    })
    this.pending = []
  }

  get frameCount(): number { return this.frames.length }

  build(): DemoFile {
    return {
      version: DEMO_VERSION,
      mapId: this.mapId,
      durationMs: this.durationMs,
      localId: this.localId,
      reserveColor: this.reserveColor,
      roster: this.roster,
      frames: this.frames,
    }
  }
}
