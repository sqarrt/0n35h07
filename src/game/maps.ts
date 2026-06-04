import * as THREE from 'three'
import { EYE_HEIGHT, NET_HUMAN_SPAWN_Z, SPAWN_HALF } from '../constants'
import type { MapId } from '../constants'

/**
 * Карты как данные — единый источник для 3D-арены (Arena), спавнов (Match) и top-down превью (MapPreview).
 * Блок = бокс: всегда даёт видимый меш + Rapier-коллайдер (полу-размеры = size). `blocksBeam` (по умолч.
 * true) — пускать ли в него raycast луча: укрытия/колонны перекрывают линию огня (true), периметровые
 * стены — декор+коллайдер, луч проходит (false), как в исходной арене. Пол рисует Arena отдельно.
 *
 * Спавны заданы по слоту: [HOST_ID, OPPONENT_ID] — точки на уровне глаз, друг напротив друга по ±Z.
 * Высота прыжка ≈ JUMP_FORCE²/(2·|GRAVITY|) ≈ 1.45 — платформы не выше, чтобы заходились прыжком.
 */

type Vec3 = [number, number, number]

export interface MapBlock {
  pos: Vec3            // центр (мировые координаты)
  size: Vec3          // полу-размеры (как у CuboidCollider)
  color: string
  blocksBeam?: boolean   // по умолчанию true; false → меш noRaycast (луч проходит, но коллайдер есть)
  rot?: Vec3           // Euler-поворот (радианы), напр. наклон рампы по X; по умолчанию нет
}

export interface GameMap {
  id: MapId            // и подпись в UI (отдельного name нет)
  floorColor: string
  blocks: MapBlock[]
  spawns: [Vec3, Vec3]   // [HOST_ID, OPPONENT_ID]
}

const ARENA_HALF = 20    // полу-размер пола (40×40)
const WALL_H = 1.5       // полу-высота периметровой стены
const WALL_T = 0.25      // полу-толщина стены

/** Четыре периметровые стены (декор+коллайдер, луч проходит — как в исходной арене). */
function perimeter(color: string): MapBlock[] {
  const bb = false
  return [
    { pos: [0, WALL_H, -ARENA_HALF], size: [ARENA_HALF, WALL_H, WALL_T], color, blocksBeam: bb },
    { pos: [0, WALL_H, ARENA_HALF], size: [ARENA_HALF, WALL_H, WALL_T], color, blocksBeam: bb },
    { pos: [-ARENA_HALF, WALL_H, 0], size: [WALL_T, WALL_H, ARENA_HALF], color, blocksBeam: bb },
    { pos: [ARENA_HALF, WALL_H, 0], size: [WALL_T, WALL_H, ARENA_HALF], color, blocksBeam: bb },
  ]
}

// «Индия» — по мотивам awp_india: центральный «мостик» (подъёмы-лестницы с двух сторон → площадка-высота с
// постройкой; под ней ряд колонн = 3 сквозные арки) + симметричные ящики-укрытия. «Ближнюю» половину (Z>0)
// зеркалим по Z. Подъёмы — ступени высотой ≤0.4 (берутся autostep'ом KCC; гладкие наклонные коллайдеры KCC
// не отрабатывает).
const INDIA_WOOD = '#8a5a2b'        // ящики
const INDIA_STONE = '#b89863'       // плита/ступени/купол
const INDIA_STONE_DK = '#9a7b46'    // колонны/постройка

// Лестница-подъём на площадку (верх y=3) со стороны +Z: ступени от z≈8 (низ) к z=3 (площадка).
const STAIR_TOP_Y = 3
const STAIR_STEPS = 10
const STAIR_Z_BOTTOM = 8
function indiaStairs(): MapBlock[] {
  const h = STAIR_TOP_Y / STAIR_STEPS                       // высота ступени 0.3 (≤ autostep 0.4)
  const d = (STAIR_Z_BOTTOM - 3) / STAIR_STEPS              // глубина ступени 0.5
  const steps: MapBlock[] = []
  for (let i = 0; i < STAIR_STEPS; i++) {
    const top = (i + 1) * h
    const zc = STAIR_Z_BOTTOM - (i + 0.5) * d               // от z=8 к z=3
    steps.push({ pos: [0, top / 2, zc], size: [3, top / 2, d / 2], color: INDIA_STONE })
  }
  return steps
}

/** Зеркало блока по оси Z (для симметрии карты); наклон по X тоже инвертируется. */
function mirrorZ(b: MapBlock): MapBlock {
  return {
    ...b,
    pos: [b.pos[0], b.pos[1], -b.pos[2]],
    rot: b.rot ? [-b.rot[0], b.rot[1], b.rot[2]] : undefined,
  }
}

// Центр (симметричен сам по себе): плита-площадка (верх y=3), 4 колонны → 3 арки снизу, постройка + купол.
const INDIA_CENTER: MapBlock[] = [
  { pos: [0, 2.75, 0], size: [9, 0.25, 3], color: INDIA_STONE },
  { pos: [-7, 1.25, 0], size: [0.5, 1.25, 2.5], color: INDIA_STONE_DK },
  { pos: [-2.5, 1.25, 0], size: [0.5, 1.25, 2.5], color: INDIA_STONE_DK },
  { pos: [2.5, 1.25, 0], size: [0.5, 1.25, 2.5], color: INDIA_STONE_DK },
  { pos: [7, 1.25, 0], size: [0.5, 1.25, 2.5], color: INDIA_STONE_DK },
  { pos: [0, 3.6, 0], size: [2, 0.6, 2], color: INDIA_STONE_DK },
  { pos: [0, 4.4, 0], size: [1.2, 0.3, 1.2], color: INDIA_STONE },
]

// Ближняя половина (Z>0): рампа на площадку + ящики (большие с приставными малыми, одиночные малые, совсем
// малые у рампы). Дальняя половина — mirrorZ.
const INDIA_HALF: MapBlock[] = [
  ...indiaStairs(),
  { pos: [-7, 1.1, 10], size: [0.6, 1.1, 0.6], color: INDIA_WOOD },        // большой (полное укрытие)
  { pos: [-5.95, 0.725, 10], size: [0.45, 0.725, 0.45], color: INDIA_WOOD }, // вплотную малый
  { pos: [7, 1.1, 10], size: [0.6, 1.1, 0.6], color: INDIA_WOOD },
  { pos: [5.95, 0.725, 10], size: [0.45, 0.725, 0.45], color: INDIA_WOOD },
  { pos: [-3, 0.725, 13], size: [0.45, 0.725, 0.45], color: INDIA_WOOD },  // одиночные малые
  { pos: [3, 0.725, 13], size: [0.45, 0.725, 0.45], color: INDIA_WOOD },
  { pos: [-4.5, 0.4, 8.5], size: [0.35, 0.4, 0.35], color: INDIA_WOOD },   // совсем малые у рампы
  { pos: [4.5, 0.4, 8.5], size: [0.35, 0.4, 0.35], color: INDIA_WOOD },
]

export const MAPS: Record<MapId, GameMap> = {
  os_arena: {
    id: 'os_arena',
    floorColor: '#444',
    blocks: perimeter('#555'),
    spawns: [
      [0, EYE_HEIGHT, NET_HUMAN_SPAWN_Z],
      [0, EYE_HEIGHT, -NET_HUMAN_SPAWN_Z],
    ],
  },

  os_india: {
    id: 'os_india',
    floorColor: '#c2a878',
    blocks: [
      ...perimeter('#8a6d3b'),
      ...INDIA_CENTER,
      ...INDIA_HALF,
      ...INDIA_HALF.map(mirrorZ),
    ],
    spawns: [
      [0, EYE_HEIGHT, 16],    // лицом к подъёму на рампу
      [0, EYE_HEIGHT, -16],
    ],
  },

  os_pillars: {
    id: 'os_pillars',
    floorColor: '#3a4150',
    blocks: [
      ...perimeter('#404a5c'),
      // Симметричная решётка высоких колонн — укрытия, блокируют луч (blocksBeam по умолчанию).
      { pos: [0, 3, 0], size: [1, 3, 1], color: '#5a6678' },
      { pos: [-8, 3, -6], size: [1, 3, 1], color: '#5a6678' },
      { pos: [8, 3, -6], size: [1, 3, 1], color: '#5a6678' },
      { pos: [-8, 3, 6], size: [1, 3, 1], color: '#5a6678' },
      { pos: [8, 3, 6], size: [1, 3, 1], color: '#5a6678' },
    ],
    spawns: [
      [0, EYE_HEIGHT, 16],
      [0, EYE_HEIGHT, -16],
    ],
  },
}

export const MAP_IDS: MapId[] = ['os_arena', 'os_india', 'os_pillars']

/** Полу-размер пола арены (для пола Arena и рамки top-down превью). */
export const ARENA_FLOOR_HALF = ARENA_HALF

/** Случайная точка в пределах игровой зоны — блуждание бота (без учёта препятствий; KCC не даёт пройти сквозь). */
export function randomArenaPos(): THREE.Vector3 {
  return new THREE.Vector3(
    (Math.random() - 0.5) * SPAWN_HALF * 2,
    1,
    (Math.random() - 0.5) * SPAWN_HALF * 2,
  )
}
