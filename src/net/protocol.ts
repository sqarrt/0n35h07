import * as THREE from 'three'
import type { BotDifficulty, MatchPhase, BallModel, MapId, MapFilter, DurationFilter, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from '../constants'
import type { BodyState } from '../game/Body'

/**
 * OneShot network protocol (host-authoritative). All payloads are
 * JSON-serializable (no THREE objects): positions/directions as Vec3 tuples.
 */

export type Vec3 = [number, number, number]

/** Transport channel tags (short — Trystero limits action names to ~12 bytes). */
export const NET_TAGS = ['hello', 'assign', 'start', 'input', 'snapshot', 'event', 'ready', 'phase'] as const
export type NetTag = typeof NET_TAGS[number]

/** Match phase: host → all (readiness/countdown before the fight). */
export interface PhaseMsg { phase: MatchPhase; ready: number[] }

// --- handshake (room) ---
export type PlayerKind = 'human' | 'bot'
/** A single match player (human or bot). The host hands the whole roster to clients. */
export interface RosterEntry {
  id:     number
  name:   string
  color:  string
  kind:   PlayerKind
  difficulty?: BotDifficulty   // only for kind==='bot'
  ballModel?: BallModel        // sphere model (cosmetic); absent → 'smooth'
  windupStyle?: WindupStyle    // charge animation (cosmetic); absent → 'classic'
  respawnStyle?: RespawnStyle  // respawn animation (cosmetic); absent → 'echo'
  dashStyle?: DashStyle        // dash trail skin (cosmetic); absent → 'streak'
  shieldStyle?: ShieldStyle    // shield skin (cosmetic); absent → 'dome'
  ballArt?: string             // art on the ball (base64, front/back 32×32); absent → empty
}
export interface Hello { name: string; primaryColor: string; reserveColor: string; desiredMap?: MapFilter; desiredDuration?: DurationFilter; ballModel?: BallModel; windupStyle?: WindupStyle; respawnStyle?: RespawnStyle; dashStyle?: DashStyle; shieldStyle?: ShieldStyle; ballArt?: string }
export interface Assign { yourId: number; roster: RosterEntry[]; durationMin: number; mapId: MapId; ready: number[] }
/** Client → host: readiness change in the lobby. */
export interface ReadyMsg { ready: boolean }
export interface Start { durationMs: number; mapId: MapId }

// --- client input → host (frequent) ---
export interface InputKeys { f: boolean; b: boolean; l: boolean; r: boolean }
export interface InputFrame {
  tick:   number     // the client SIM TICK this input was produced on (fixed 60 Hz) — the host applies it tick-aligned
                     // and echoes the last-applied tick as Snapshot.ackTick for the client's prediction reconciliation
  keys:   InputKeys
  aimDir: Vec3       // look direction (for the movement basis and aim)
  aimOrigin?: Vec3   // client's camera position — origin of the aim ray (in third person offset behind the back; the host replays it exactly). Absent → host fires from the eyes
  jump:   boolean    // held jump state (auto-bhop/double jump is computed by Body on the host)
  fire:   boolean    // edge actions (fire/shield/dash) — one-shot per frame
  shield: boolean
  dash:   boolean
}

// --- world state: host → all (frequent) ---
export interface PlayerSnapshot {
  id:             number
  pos:            Vec3
  aimDir:         Vec3
  alive:          boolean
  shieldActive:   boolean
  dashing:        boolean
  windupProgress: number
  respawning:     boolean   // ghost phase (semi-transparent, invulnerable)
  restore:        BodyState // authoritative movement state — the LOCAL player uses it to restore before replay (opponent ignores it)
}
export interface Snapshot {
  ackTick: number              // last client SIM TICK the host applied (for prediction reconciliation)
  players: PlayerSnapshot[]
}

// --- match events: host → all (reliable, ordered) ---
export interface ScoreLine { name: string; kills: number; deaths: number }
export type MatchEvent =
  | { t: 'fired';   id: number; end: Vec3; hitPoint: Vec3 | null; hit: number | null }   // hit — id of the one hit (to suppress sparks on own FP camera)
  | { t: 'kill';    shooter: number; victim: number; streak: number; firstBlood: boolean; bounty: number; resetCd: boolean }
  | { t: 'block';   shooter: number; victim: number; perfect: boolean }
  | { t: 'respawn'; id: number; pos: Vec3 }
  | { t: 'move';    id: number; kind: 'jump' | 'land'; pos: Vec3 }   // discrete opponent movement (host → client)
  | { t: 'scores';  scores: ScoreLine[] }
  | { t: 'time';     remainingMs: number }
  | { t: 'matchEnd'; reason: 'time' | 'disconnect' }

// --- Vec3 ↔ THREE.Vector3 helpers ---
export function toVec3(v: THREE.Vector3): Vec3 { return [v.x, v.y, v.z] }
export function fromVec3(t: Vec3): THREE.Vector3 { return new THREE.Vector3(t[0], t[1], t[2]) }
export function applyVec3(t: Vec3, out: THREE.Vector3): THREE.Vector3 { return out.set(t[0], t[1], t[2]) }
