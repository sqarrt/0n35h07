import { BALL_RADIUS } from '../constants'

/** Последний кликнутый блок экрана «Внешность» — определяет позицию шара-превью. */
export type AppearancePart = 'color' | 'model' | 'shot' | 'respawn'

/** Позиции шара на фоне меню-экранов. */
export type Pos = 'center' | 'left-edge' | 'right-edge' | 'settings-left' | 'shot-right' | 'respawn-far'

export interface Viewport { width: number; height: number }
export interface BallTarget { x: number; y: number; z: number; scale: number }

const BIG_FRACTION = 0.4           // радиус крупного шара = доля высоты viewport (диаметр ≈ 0.8 высоты)
const SETTINGS_X_FRACTION = 0.26   // смещение влево на экране внешности (доля ширины)
const SETTINGS_H_FRACTION = 0.32   // масштаб по высоте, чтобы шар влез целиком слева
const SETTINGS_W_FRACTION = 0.22   // масштаб по ширине, чтобы шар влез целиком слева
// Подвкладка ВЫСТРЕЛ: шар справа сверху, отодвинут вглубь — стреляет по диагонали вниз-влево,
// луч и пасть разворачиваются через свободную часть экрана.
const SHOT_X_FRACTION = -0.18      // левее центра — пасть и луч разворачиваются в свободной зоне
const SHOT_Y_FRACTION = -0.03      // чуть ниже центра — раскрытая пасть сверху не вылезает за кадр
const SHOT_Z_OFFSET = -5.5         // вглубь от камеры, чтобы пасть и луч влезали целиком
const SHOT_SCALE_FACTOR = 1 / 1.5  // шар на ВЫСТРЕЛЕ мельче превью цвета/модели — место под пасть и луч
// Превью респавна: шар вглубь сцены, но ЭКРАННО — в центре свободной зоны слева от панели
// (во время цикла он едет по кругу). Позиция на глубине компенсируется перспективой (atDepth).
const RESPAWN_Z_OFFSET = -7.5

/** Камера фона меню (Canvas в MenuBackdrop) — нужна для компенсации перспективы на глубине. */
export const MENU_CAMERA_POS: [number, number, number] = [0, 3.02, 5.18]
const CAM_Y = MENU_CAMERA_POS[1]
const CAM_Z = MENU_CAMERA_POS[2]

/** Мировая точка на глубине z, видимая там же, где точка (xApparent, 0, 0) плоскости z=0.
 *  Камера смотрит в начало координат: центр экрана на глубине лежит на луче взгляда
 *  (y = CAM_Y·z/CAM_Z), боковые смещения растут с удалением (множитель 1 − z/CAM_Z). */
function atDepth(xApparent: number, z: number): { x: number; y: number } {
  const k = 1 - z / CAM_Z
  return { x: xApparent * k, y: CAM_Y * (z / CAM_Z) }
}

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
    case 'shot-right':    return { x: vp.width * SHOT_X_FRACTION, y: vp.height * SHOT_Y_FRACTION, z: SHOT_Z_OFFSET, scale: previewScale(vp) * SHOT_SCALE_FACTOR }
    case 'respawn-far': {
      // Экранно — там же, где settings-left (центр зоны слева от панели), но вглубь сцены.
      const p = atDepth(-vp.width * SETTINGS_X_FRACTION, RESPAWN_Z_OFFSET)
      return { x: p.x, y: p.y, z: RESPAWN_Z_OFFSET, scale: previewScale(vp) * SHOT_SCALE_FACTOR }
    }
  }
}

/** Стартовая x за кадром для шара, который должен «выехать» к своей кромке. */
export function offscreenX(pos: Pos, vp: Viewport): number {
  return pos === 'right-edge' ? vp.width : -vp.width
}
