import * as THREE from 'three'
import { EYE_HEIGHT } from '../constants'

/** Экраны, которые обслуживает фон меню. */
export type MenuMode = 'menu' | 'join' | 'lobby' | 'settings' | 'appearance'

/** Последний кликнутый блок экрана «Внешность» — выбирает ракурс камеры. */
export type AppearancePart = 'color' | 'model' | 'shot' | 'respawn' | 'dash' | 'shield'

/** Состояния камеры фона меню. Позы хранятся в menuCameraPoses.json (правятся клавишей J в dev).
 *  lobby — ты хост (вдвоём); lobbyClient — ты подключился клиентом (вдвоём, свой ракурс). */
export type MenuCameraState = 'default' | 'lobby' | 'lobbyClient' | 'appearance' | 'appearanceShot' | 'appearanceRespawn' | 'appearanceDash' | 'appearanceShield'

export interface CameraPose { position: [number, number, number]; target: [number, number, number] }
export type CameraPoses = Record<MenuCameraState, CameraPose>

/** Сценические точки игроков (позиция ГЛАЗ, как спавн в матче). Модели стоят — двигается камера. */
export const PLAYER_SPOT = new THREE.Vector3(0, EYE_HEIGHT, 0)
export const OPPONENT_SPOT = new THREE.Vector3(1.8, EYE_HEIGHT, 0)

/** Камера-состояние по экрану и контексту: лобби вдвоём (хост/клиент — разные ракурсы),
 *  блоки «Внешности», иначе дефолт. */
export function cameraStateFor(mode: MenuMode, hasOpponent: boolean, isClient: boolean, part: AppearancePart): MenuCameraState {
  if (mode === 'appearance') {
    if (part === 'shot') return 'appearanceShot'
    if (part === 'respawn') return 'appearanceRespawn'
    if (part === 'dash') return 'appearanceDash'
    if (part === 'shield') return 'appearanceShield'
    return 'appearance'
  }
  if (mode === 'lobby' && hasOpponent) return isClient ? 'lobbyClient' : 'lobby'
  return 'default'
}
