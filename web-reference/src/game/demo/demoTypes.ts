/**
 * Demo recording format. KEY principle — FRAME INDEPENDENCE: each DemoFrame holds the FULL
 * absolute scene state (camera, players' render state, score, timer, streaks, phase) + only this
 * frame's transient FX (shot/kill/block). Hence any contiguous sub-range frames[i..j]
 * plays back correctly on its own — without knowledge of previous frames.
 */
import type { MatchEvent, Vec3, RosterEntry } from '../../net/protocol'
import type { MatchPhase, MapId } from '../../constants'

export const DEMO_VERSION = 1

export interface DemoCam {
  p: Vec3                                   // camera position
  q: [number, number, number, number]       // quaternion (x,y,z,w)
  fov: number
}

/** Absolute per-frame render state of a player (everything needed to draw them and their HUD contribution). */
export interface DemoPlayerState {
  id: number
  pos: Vec3
  aimDir: Vec3
  alive: boolean
  shieldActive: boolean
  dashing: boolean
  windupProgress: number
  respawning: boolean
  bodyVisible: boolean       // in FP your own sphere is hidden — recorded so replay reproduces it
  kills: number              // absolute score (for a correct HUD on any sub-range)
  deaths: number
  streakCount: number        // current streak (tier is derived on playback)
  // Cooldowns for the POV player's HUD (readiness: 1 = ready). Absent in old demos → defaults on playback.
  beamCooldown?: number      // crosshair (beam readiness)
  dashCooldown?: number      // dash indicator
  shieldProgress?: number    // shield brackets (shield readiness)
  respawnProgress?: number   // respawn overlay (1→0); meaningful when respawning=true
}

export interface DemoFrame {
  tMs: number                // time from recording start (for timing/slicing)
  cam: DemoCam
  players: DemoPlayerState[]
  remainingMs: number        // remaining match timer (absolute)
  phase: MatchPhase
  events: MatchEvent[]       // this frame's transient FX (shots/kills/blocks/respawns/move)
}

export interface DemoFile {
  version: typeof DEMO_VERSION
  mapId: MapId
  durationMs: number
  localId: number            // whose "eyes" it was recorded through (for reference; camera is in DemoCam anyway)
  reserveColor?: string      // local player's "secondary" color (planet ring); absent → taken from profile
  roster: RosterEntry[]      // players' colors/models/skins — to build the same Body on playback
  frames: DemoFrame[]
}
