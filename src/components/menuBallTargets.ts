import { BALL_RADIUS } from '../constants'

/** Последний кликнутый блок экрана «Внешность» — определяет ракурс камеры (CameraRig). */
export type AppearancePart = 'color' | 'model' | 'shot' | 'respawn'

/** Позиции шара на фоне меню-экранов. */
export type Pos = 'center' | 'left-edge' | 'right-edge' | 'settings-left'

export interface Viewport { width: number; height: number }
export interface BallTarget { x: number; y: number; z: number; scale: number }

const BIG_FRACTION = 0.4           // радиус крупного шара = доля высоты viewport (диаметр ≈ 0.8 высоты)
const SETTINGS_X_FRACTION = 0.26   // смещение влево на экране внешности (доля ширины)
const SETTINGS_H_FRACTION = 0.32   // масштаб по высоте, чтобы шар влез целиком слева
const SETTINGS_W_FRACTION = 0.22   // масштаб по ширине, чтобы шар влез целиком слева

/** Камера фона меню (Canvas в MenuBackdrop): дефолтный ракурс; «Внешность» двигает её через CameraRig. */
export const MENU_CAMERA_POS: [number, number, number] = [0, 3.02, 5.18]

/** Масштаб шара-превью на экране внешности (влезает целиком сбоку от панели). */
function previewScale(vp: Viewport): number {
  return Math.min(vp.height * SETTINGS_H_FRACTION, vp.width * SETTINGS_W_FRACTION) / BALL_RADIUS
}

/** Целевые мировые координаты и масштаб для позиции (из размеров viewport — resize-safe). */
export function resolveTarget(pos: Pos, vp: Viewport): BallTarget {
  const big = (vp.height * BIG_FRACTION) / BALL_RADIUS
  switch (pos) {
    case 'center':        return { x: 0, y: 0, z: 0, scale: big }
    case 'left-edge':     return { x: -vp.width / 2, y: 0, z: 0, scale: big }   // центр на кромке → половина за кадром
    case 'right-edge':    return { x: vp.width / 2, y: 0, z: 0, scale: big }
    case 'settings-left': return { x: -vp.width * SETTINGS_X_FRACTION, y: 0, z: 0, scale: previewScale(vp) }
  }
}

/** Стартовая x за кадром для шара, который должен «выехать» к своей кромке. */
export function offscreenX(pos: Pos, vp: Viewport): number {
  return pos === 'right-edge' ? vp.width : -vp.width
}
