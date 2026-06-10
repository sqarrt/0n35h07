import { BALL_RADIUS } from '../constants'

/** Подвкладка экрана «Внешность» — определяет позицию шара-превью. */
export type AppearancePart = 'color' | 'model' | 'shot'

/** Позиции шара на фоне меню-экранов. */
export type Pos = 'center' | 'left-edge' | 'right-edge' | 'settings-left' | 'shot-right'

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
  }
}

/** Стартовая x за кадром для шара, который должен «выехать» к своей кромке. */
export function offscreenX(pos: Pos, vp: Viewport): number {
  return pos === 'right-edge' ? vp.width : -vp.width
}
