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
  half: [number, number]   // полу-размеры пола арены [X, Z] — карта может быть прямоугольной (длиннее по Z)
  floorColor: string
  blocks: MapBlock[]
  spawns: [Vec3, Vec3]   // [HOST_ID, OPPONENT_ID]
}

const WALL_H = 1.5       // полу-высота периметровой стены
const WALL_T = 0.25      // полу-толщина стены

/** Четыре периметровые стены по размеру пола [hx, hz] (декор+коллайдер, луч проходит). */
function perimeter(color: string, hx: number, hz: number): MapBlock[] {
  const bb = false
  return [
    { pos: [0, WALL_H, -hz], size: [hx, WALL_H, WALL_T], color, blocksBeam: bb },
    { pos: [0, WALL_H, hz], size: [hx, WALL_H, WALL_T], color, blocksBeam: bb },
    { pos: [-hx, WALL_H, 0], size: [WALL_T, WALL_H, hz], color, blocksBeam: bb },
    { pos: [hx, WALL_H, 0], size: [WALL_T, WALL_H, hz], color, blocksBeam: bb },
  ]
}

// «Индия» — по мотивам awp_india: центральный «мостик» (подъёмы-лестницы с двух сторон → площадка-высота с
// постройкой; под ней ряд колонн = 3 сквозные арки) + симметричные ящики-укрытия. «Ближнюю» половину (Z>0)
// зеркалим по Z. Подъёмы — ступени высотой ≤0.4 (берутся autostep'ом KCC; гладкие наклонные коллайдеры KCC
// не отрабатывает).
const INDIA_WOOD = '#8a5a2b'        // ящики
const INDIA_STONE = '#b89863'       // плита/ступени/купол
const INDIA_STONE_DK = '#9a7b46'    // колонны/постройка

// Карта вытянута по Z (длинные подъёмы): пол 40×80.
const INDIA_ARENA: [number, number] = [20, 40]
const INDIA_PLAT_HZ = 5      // полу-глубина центральной площадки (z ∈ [-5, 5])
const INDIA_PLAT_TOP = 3     // верх площадки

// Лестница-подъём (верх y=3) со стороны +Z: длинные пологие ступени от z=низ к z=край площадки.
const STAIR_STEPS = 12
const STAIR_Z_BOTTOM = 22    // низ лестницы (ближе к спавну)
function indiaStairs(): MapBlock[] {
  const h = INDIA_PLAT_TOP / STAIR_STEPS                    // высота ступени 0.25 (≤ autostep 0.4)
  const d = (STAIR_Z_BOTTOM - INDIA_PLAT_HZ) / STAIR_STEPS  // глубина ступени ~1.4 (пологий длинный подъём)
  const steps: MapBlock[] = []
  for (let i = 0; i < STAIR_STEPS; i++) {
    const top = (i + 1) * h
    const zc = STAIR_Z_BOTTOM - (i + 0.5) * d               // от z=22 к z=5
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
  { pos: [0, 2.75, 0], size: [9, 0.25, INDIA_PLAT_HZ], color: INDIA_STONE },
  { pos: [-7, 1.25, 0], size: [0.5, 1.25, INDIA_PLAT_HZ], color: INDIA_STONE_DK },
  { pos: [-2.5, 1.25, 0], size: [0.5, 1.25, INDIA_PLAT_HZ], color: INDIA_STONE_DK },
  { pos: [2.5, 1.25, 0], size: [0.5, 1.25, INDIA_PLAT_HZ], color: INDIA_STONE_DK },
  { pos: [7, 1.25, 0], size: [0.5, 1.25, INDIA_PLAT_HZ], color: INDIA_STONE_DK },
  { pos: [0, 3.6, 0], size: [2, 0.6, 2], color: INDIA_STONE_DK },
  { pos: [0, 4.4, 0], size: [1.2, 0.3, 1.2], color: INDIA_STONE },
]

// Ближняя половина (Z>0): подъём-лестница на площадку + ящики (большие с приставными малыми, одиночные малые,
// совсем малые у рампы). Дальняя половина — mirrorZ. Двор длинный (до z≈40), ящики разнесены.
const INDIA_HALF: MapBlock[] = [
  ...indiaStairs(),
  { pos: [-7, 1.1, 16], size: [0.6, 1.1, 0.6], color: INDIA_WOOD },         // большой (полное укрытие)
  { pos: [-5.95, 0.725, 16], size: [0.45, 0.725, 0.45], color: INDIA_WOOD }, // вплотную малый
  { pos: [7, 1.1, 16], size: [0.6, 1.1, 0.6], color: INDIA_WOOD },
  { pos: [5.95, 0.725, 16], size: [0.45, 0.725, 0.45], color: INDIA_WOOD },
  { pos: [-3, 0.725, 29], size: [0.45, 0.725, 0.45], color: INDIA_WOOD },   // одиночные малые (у спавна)
  { pos: [3, 0.725, 29], size: [0.45, 0.725, 0.45], color: INDIA_WOOD },
  { pos: [-4.5, 0.4, 23.5], size: [0.35, 0.4, 0.35], color: INDIA_WOOD },   // совсем малые у низа подъёма
  { pos: [4.5, 0.4, 23.5], size: [0.35, 0.4, 0.35], color: INDIA_WOOD },
]

export const MAPS: Record<MapId, GameMap> = {
  os_arena: {
    id: 'os_arena',
    half: [20, 20],
    floorColor: '#444',
    blocks: perimeter('#555', 20, 20),
    spawns: [
      [0, EYE_HEIGHT, NET_HUMAN_SPAWN_Z],
      [0, EYE_HEIGHT, -NET_HUMAN_SPAWN_Z],
    ],
  },

  os_india: {
    id: 'os_india',
    half: INDIA_ARENA,
    floorColor: '#c2a878',
    blocks: [
      ...perimeter('#8a6d3b', INDIA_ARENA[0], INDIA_ARENA[1]),
      ...INDIA_CENTER,
      ...INDIA_HALF,
      ...INDIA_HALF.map(mirrorZ),
    ],
    spawns: [
      [0, EYE_HEIGHT, 34],    // на краях длинной арены, лицом к подъёму
      [0, EYE_HEIGHT, -34],
    ],
  },

  os_pillars: {
    id: 'os_pillars',
    half: [20, 20],
    floorColor: '#3a4150',
    blocks: [
      ...perimeter('#404a5c', 20, 20),
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

/** Случайная точка в пределах игровой зоны — блуждание бота (без учёта препятствий; KCC не даёт пройти сквозь). */
export function randomArenaPos(): THREE.Vector3 {
  return new THREE.Vector3(
    (Math.random() - 0.5) * SPAWN_HALF * 2,
    1,
    (Math.random() - 0.5) * SPAWN_HALF * 2,
  )
}
