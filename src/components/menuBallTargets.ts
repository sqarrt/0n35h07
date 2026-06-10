import { BALL_RADIUS } from '../constants'

/** Подвкладка экрана «Внешность» — определяет позицию шара-превью. */
export type AppearancePart = 'color' | 'model' | 'shot'

/** Позиции шара на фоне меню-экранов. */
export type Pos = 'center' | 'left-edge' | 'right-edge' | 'settings-left' | 'shot-left'

export interface Viewport { width: number; height: number }
export interface BallTarget { x: number; z: number; scale: number }

const BIG_FRACTION = 0.4           // радиус крупного шара = доля высоты viewport (диаметр ≈ 0.8 высоты)
const SETTINGS_X_FRACTION = 0.26   // смещение влево на экране внешности (доля ширины)
const SETTINGS_H_FRACTION = 0.32   // масштаб по высоте, чтобы шар влез целиком слева
const SETTINGS_W_FRACTION = 0.22   // масштаб по ширине, чтобы шар влез целиком слева
const SHOT_Z_OFFSET = -2.2         // подвкладка ВЫСТРЕЛ: шар отодвинут от камеры (вглубь сцены)

/** Позиция слева для экрана внешности (общая для подвкладок ЦВЕТ/МОДЕЛЬ/ВЫСТРЕЛ). */
function leftTarget(vp: Viewport): { x: number; scale: number } {
  const scale = Math.min(vp.height * SETTINGS_H_FRACTION, vp.width * SETTINGS_W_FRACTION) / BALL_RADIUS
  return { x: -vp.width * SETTINGS_X_FRACTION, scale }
}

/** Целевые мировые координаты и масштаб для позиции (из размеров viewport — resize-safe). */
export function resolveTarget(pos: Pos, vp: Viewport): BallTarget {
  const big = (vp.height * BIG_FRACTION) / BALL_RADIUS
  switch (pos) {
    case 'center':        return { x: 0, z: 0, scale: big }
    case 'left-edge':     return { x: -vp.width / 2, z: 0, scale: big }   // центр на кромке → половина за кадром
    case 'right-edge':    return { x: vp.width / 2, z: 0, scale: big }
    case 'settings-left': return { ...leftTarget(vp), z: 0 }
    case 'shot-left':     return { ...leftTarget(vp), z: SHOT_Z_OFFSET }   // дальше от камеры — выстрел виден целиком
  }
}

/** Стартовая x за кадром для шара, который должен «выехать» к своей кромке. */
export function offscreenX(pos: Pos, vp: Viewport): number {
  return pos === 'right-edge' ? vp.width : -vp.width
}
