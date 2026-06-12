import * as THREE from 'three'
import type { BotDifficulty, MatchPhase, BallModel, MapId, MapFilter, DurationFilter, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from '../constants'

/**
 * Сетевой протокол OneShot (host-authoritative). Все полезные нагрузки —
 * JSON-сериализуемые (без THREE-объектов): позиции/направления как кортежи Vec3.
 */

export type Vec3 = [number, number, number]

/** Теги каналов транспорта (короткие — у Trystero лимит ~12 байт на имя action). */
export const NET_TAGS = ['hello', 'assign', 'start', 'input', 'snapshot', 'event', 'ready', 'phase'] as const
export type NetTag = typeof NET_TAGS[number]

/** Фаза матча: хост → все (готовность/отсчёт перед боем). */
export interface PhaseMsg { phase: MatchPhase; ready: number[] }

// --- handshake (комната) ---
export type PlayerKind = 'human' | 'bot'
/** Один игрок матча (человек или бот). Хост раздаёт весь ростер клиентам. */
export interface RosterEntry {
  id:     number
  name:   string
  color:  string
  kind:   PlayerKind
  difficulty?: BotDifficulty   // только для kind==='bot'
  ballModel?: BallModel        // модель сферы (косметика); нет → 'smooth'
  windupStyle?: WindupStyle    // анимация заряда (косметика); нет → 'classic'
  respawnStyle?: RespawnStyle  // анимация респавна (косметика); нет → 'echo'
  dashStyle?: DashStyle        // скин следа рывка (косметика); нет → 'streak'
  shieldStyle?: ShieldStyle    // скин щита (косметика); нет → 'dome'
}
export interface Hello { name: string; primaryColor: string; reserveColor: string; desiredMap?: MapFilter; desiredDuration?: DurationFilter; ballModel?: BallModel; windupStyle?: WindupStyle; respawnStyle?: RespawnStyle; dashStyle?: DashStyle; shieldStyle?: ShieldStyle }
export interface Assign { yourId: number; roster: RosterEntry[]; durationMin: number; mapId: MapId; ready: number[] }
/** Клиент → хост: смена готовности в лобби. */
export interface ReadyMsg { ready: boolean }
export interface Start { durationMs: number; mapId: MapId }

// --- ввод клиента → хост (часто) ---
export interface InputKeys { f: boolean; b: boolean; l: boolean; r: boolean }
export interface InputFrame {
  seq:    number
  keys:   InputKeys
  aimDir: Vec3       // направление взгляда (для basis движения и прицела)
  jump:   boolean    // held-состояние прыжка (auto-bhop/двойной прыжок считает Body на хосте)
  fire:   boolean    // рёберные действия (fire/shield/dash) — one-shot за кадр
  shield: boolean
  dash:   boolean
}

// --- состояние мира: хост → все (часто) ---
export interface PlayerSnapshot {
  id:             number
  pos:            Vec3
  aimDir:         Vec3
  alive:          boolean
  shieldActive:   boolean
  dashing:        boolean
  windupProgress: number
  respawning:     boolean   // фаза призрака (полупрозрачный, неуязвим)
}
export interface Snapshot {
  ackSeq:  number              // последний обработанный seq ввода клиента (для реконсиляции)
  players: PlayerSnapshot[]
}

// --- события матча: хост → все (надёжно, по порядку) ---
export interface ScoreLine { name: string; kills: number; deaths: number }
export type MatchEvent =
  | { t: 'fired';   id: number; end: Vec3; hitPoint: Vec3 | null; hit: number | null }   // hit — id попавшего (для подавления искр на своей FP-камере)
  | { t: 'kill';    shooter: number; victim: number }
  | { t: 'block';   shooter: number; victim: number }
  | { t: 'respawn'; id: number; pos: Vec3 }
  | { t: 'move';    id: number; kind: 'jump' | 'land'; pos: Vec3 }   // дискретное движение соперника (host → client)
  | { t: 'scores';  scores: ScoreLine[] }
  | { t: 'time';     remainingMs: number }
  | { t: 'matchEnd'; reason: 'time' | 'disconnect' }

// --- хелперы Vec3 ↔ THREE.Vector3 ---
export function toVec3(v: THREE.Vector3): Vec3 { return [v.x, v.y, v.z] }
export function fromVec3(t: Vec3): THREE.Vector3 { return new THREE.Vector3(t[0], t[1], t[2]) }
export function applyVec3(t: Vec3, out: THREE.Vector3): THREE.Vector3 { return out.set(t[0], t[1], t[2]) }
