import * as THREE from 'three'
import type { BotDifficulty, MatchPhase, BallModel, MapId, MapFilter, DurationFilter, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from '../constants'
import type { GameMode } from '../game/modes'

/**
 * OneShot network protocol (host-authoritative). All payloads are
 * JSON-serializable (no THREE objects): positions/directions as Vec3 tuples.
 */

export type Vec3 = [number, number, number]

/** Transport channel tags (short — Trystero limits action names to ~12 bytes). */
export const NET_TAGS = ['hello', 'assign', 'start', 'snapshot', 'event', 'ready', 'phase', 'hit', 'setSlot'] as const
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
  reserveColor?: string        // second appearance color (planet ring today; future models may use it differently); absent → color
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
export interface Assign { yourId: number; roster: RosterEntry[]; durationMin: number; mapId: MapId; ready: number[]; mode: GameMode; owners: Record<number, string> }
/** Client → host: readiness change in the lobby. */
export interface ReadyMsg { ready: boolean }
/** Client → host: move me to this FREE slot (2v2 team change; harmless seat swap elsewhere). */
export interface SetSlotMsg { slot: number }
export interface Start {
  durationMs: number
  mapId: MapId
  spawns?: Vec3[]   // FFA start positions by occupied-slot order (creator-generated → identical on every peer)
  owners: Record<number, string>   // player id → transport PeerId of its OWNER (humans — their peer; bots — the creator's)
}

/** Shooter-authoritative hit: the shooter's peer raycasts its own beam locally and claims the result; the claim is
 *  addressed to the VICTIM'S OWNER, who judges it against its real local state (alive / ghost / shield — "the shield
 *  wins") and broadcasts the verdict as a kill/block event — so "what you shot is what you hit", no lag-comp rewind. */
export interface HitClaim {
  shooter: number    // the shooter's player id (may be a bot simulated by the sending peer)
  hitId: number | null
  point: Vec3 | null // impact point (null on a wall/miss)
  end:   Vec3        // the beam's end point (to render the shooter's beam toward the claim)
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
}
export interface Snapshot {
  tick:    number              // sender's sim tick at serialize (interpolation ordering)
  players: PlayerSnapshot[]    // ONLY the sender's owned players
}

// --- match events: host → all (reliable, ordered) ---
export type MatchEvent =
  | { t: 'fired';   id: number; end: Vec3; hitPoint: Vec3 | null; hit: number | null }   // hit — id of the one hit (to suppress sparks on own FP camera)
  // Slim on purpose: score/streak/bounty/firstBlood are DERIVED by every peer from the (shooter, victim) stream.
  // The optional legacy fields keep old RECORDED demos (trailer sources) parseable — live code never reads them.
  | { t: 'kill';    shooter: number; victim: number; streak?: number; firstBlood?: boolean; bounty?: number; resetCd?: boolean }
  | { t: 'block';   shooter: number; victim: number; perfect: boolean }
  | { t: 'respawn'; id: number; pos: Vec3 }
  | { t: 'move';    id: number; kind: 'jump' | 'land'; pos: Vec3 }   // discrete opponent movement (host → client)
  | { t: 'ready';   id: number }   // mesh: a peer declares one of ITS players ready (the creator stamps the countdown)


// --- Vec3 ↔ THREE.Vector3 helpers ---
export function toVec3(v: THREE.Vector3): Vec3 { return [v.x, v.y, v.z] }
export function fromVec3(t: Vec3): THREE.Vector3 { return new THREE.Vector3(t[0], t[1], t[2]) }
export function applyVec3(t: Vec3, out: THREE.Vector3): THREE.Vector3 { return out.set(t[0], t[1], t[2]) }
