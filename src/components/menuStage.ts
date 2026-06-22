import * as THREE from 'three'
import { EYE_HEIGHT } from '../constants'

/** Screens served by the menu background. */
export type MenuMode = 'menu' | 'lobby' | 'settings' | 'appearance'

/** Last clicked block of the "Appearance" screen — selects the camera angle.
 *  paintFront/paintBack — painting front/back (camera orbits the orb to the needed side). */
export type AppearancePart = 'color' | 'model' | 'shot' | 'respawn' | 'dash' | 'shield' | 'paintFront' | 'paintBack'

/** Camera states for the menu background. Poses are stored in menuCameraPoses.json (edited with the J key in dev).
 *  room — you are the host (both present); roomClient — you joined as a client (both present, your own angle). */
export type MenuCameraState = 'default' | 'room' | 'roomClient' | 'appearance' | 'appearanceShot' | 'appearanceRespawn' | 'appearanceDash' | 'appearanceShield' | 'appearancePaintFront' | 'appearancePaintBack'

export interface CameraPose { position: [number, number, number]; target: [number, number, number] }
export type CameraPoses = Record<MenuCameraState, CameraPose>

/** Stage spots for players (EYE position, like a match spawn). Models stay put — the camera moves. */
export const PLAYER_SPOT = new THREE.Vector3(0, EYE_HEIGHT, 0)
export const OPPONENT_SPOT = new THREE.Vector3(1.8, EYE_HEIGHT, 0)

/** Camera state by screen and context: room with both present (host/client — different angles),
 *  "Appearance" blocks, otherwise default. */
export function cameraStateFor(mode: MenuMode, hasOpponent: boolean, isClient: boolean, part: AppearancePart): MenuCameraState {
  if (mode === 'appearance') {
    if (part === 'shot') return 'appearanceShot'
    if (part === 'respawn') return 'appearanceRespawn'
    if (part === 'dash') return 'appearanceDash'
    if (part === 'shield') return 'appearanceShield'
    if (part === 'paintFront') return 'appearancePaintFront'
    if (part === 'paintBack') return 'appearancePaintBack'
    return 'appearance'
  }
  if (mode === 'lobby' && hasOpponent) return isClient ? 'roomClient' : 'room'
  return 'default'
}
