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

// «Индия»: две приподнятые базы у ∓Z + центральные укрытия. База: полу-высота 0.6 → верх y=1.2 (заходится
// прыжком); спавн на базе = верх + уровень глаз.
const INDIA_BASE_HY = 0.6
const INDIA_BASE_Z = 14
const INDIA_BASE_TOP = INDIA_BASE_HY * 2
const INDIA_SPAWN_Y = INDIA_BASE_TOP + EYE_HEIGHT

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
      // Две базы друг напротив друга.
      { pos: [0, INDIA_BASE_HY, INDIA_BASE_Z], size: [6, INDIA_BASE_HY, 4], color: '#b08d57' },
      { pos: [0, INDIA_BASE_HY, -INDIA_BASE_Z], size: [6, INDIA_BASE_HY, 4], color: '#b08d57' },
      // Центральные укрытия (перекрывают линию огня по центру).
      { pos: [-4.5, 0.9, 0], size: [1.5, 0.9, 1.5], color: '#9a7b46' },
      { pos: [4.5, 0.9, 0], size: [1.5, 0.9, 1.5], color: '#9a7b46' },
      { pos: [0, 1, 0], size: [3, 1, 0.6], color: '#9a7b46' },
    ],
    spawns: [
      [0, INDIA_SPAWN_Y, INDIA_BASE_Z],
      [0, INDIA_SPAWN_Y, -INDIA_BASE_Z],
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
