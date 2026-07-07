import * as THREE from 'three'
import { EYE_HEIGHT } from '../constants'

/** Screens served by the menu background. */
export type MenuMode = 'menu' | 'lobby' | 'settings' | 'appearance'

/** Last clicked block of the "Appearance" screen — selects the camera angle.
 *  paintFront/paintBack — painting front/back (camera orbits the orb to the needed side). */
export type AppearancePart = 'color' | 'model' | 'shot' | 'respawn' | 'dash' | 'shield' | 'paintFront' | 'paintBack'

/** Camera states for the menu background. Poses are stored in menuCameraPoses.json (edited with the J key in dev).
 *  room — you are the host (both present); roomClient — you joined as a client (both present, your own angle);
 *  lobby4 — more than two seats are occupied (Battle/War), the whole square is in frame. */
export type MenuCameraState = 'default' | 'room' | 'roomClient' | 'lobby4' | 'appearance' | 'appearanceShot' | 'appearanceRespawn' | 'appearanceDash' | 'appearanceShield' | 'appearancePaintFront' | 'appearancePaintBack'

export interface CameraPose { position: [number, number, number]; target: [number, number, number] }
export type CameraPoses = Record<MenuCameraState, CameraPose>

/** Stage spots for players (EYE position, like a match spawn), indexed by lobby slot id.
 *  Slots 0/1 are the classic Duel pair (the picture doesn't move); 2/3 complete the square behind them —
 *  in Battle the teams face each other row vs row. Models stay put — the camera moves. */
export const STAGE_SPOTS = [
  new THREE.Vector3(0, EYE_HEIGHT, 0),        // slot 0 (creator)
  new THREE.Vector3(1.8, EYE_HEIGHT, 0),      // slot 1 (the classic opponent spot)
  new THREE.Vector3(1.8, EYE_HEIGHT, -1.8),   // slot 2
  new THREE.Vector3(0, EYE_HEIGHT, -1.8),     // slot 3
]
export const PLAYER_SPOT = STAGE_SPOTS[0]
export const OPPONENT_SPOT = STAGE_SPOTS[1]

const LOBBY4_MIN_OCCUPIED = 3   // 3+ balls on stage → the wide "square" pose

/** Camera state by screen and context: lobby with company (pair — host/client angles; 3+ — the square),
 *  "Appearance" blocks, otherwise default. */
export function cameraStateFor(mode: MenuMode, occupied: number, isClient: boolean, part: AppearancePart): MenuCameraState {
  if (mode === 'appearance') {
    if (part === 'shot') return 'appearanceShot'
    if (part === 'respawn') return 'appearanceRespawn'
    if (part === 'dash') return 'appearanceDash'
    if (part === 'shield') return 'appearanceShield'
    if (part === 'paintFront') return 'appearancePaintFront'
    if (part === 'paintBack') return 'appearancePaintBack'
    return 'appearance'
  }
  if (mode === 'lobby' && occupied >= LOBBY4_MIN_OCCUPIED) return 'lobby4'
  if (mode === 'lobby' && occupied > 1) return isClient ? 'roomClient' : 'room'
  return 'default'
}
