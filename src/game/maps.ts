import * as THREE from 'three'
import { SPAWN_HALF } from '../constants'
import type { MapId } from '../constants'
import os_arena from '../maps/os_arena/raw.json'
import os_india from '../maps/os_india/raw.json'
import os_pillars from '../maps/os_pillars/raw.json'
import { parseGeo } from './mapGeometryCache'
import type { CompiledMap } from './mapGeometryCache'

/**
 * Карты как данные — единый источник для 3D-арены (Arena), спавнов (Match) и top-down превью (MapPreview).
 * Блок = бокс: всегда даёт видимый меш + Rapier-коллайдер (полу-размеры = size). `blocksBeam` (по умолч.
 * true) — пускать ли в него raycast луча: укрытия/колонны перекрывают линию огня (true), периметровые
 * стены — декор+коллайдер, луч проходит (false), как в исходной арене. Пол рисует Arena отдельно.
 *
 * Спавны заданы по слоту: [HOST_ID, OPPONENT_ID] — точки на уровне глаз, друг напротив друга по ±Z.
 * Высота прыжка ≈ JUMP_FORCE²/(2·|GRAVITY|) ≈ 1.45 — платформы не выше, чтобы заходились прыжком.
 */

export type Vec3 = [number, number, number]

export interface MapBlock {
  pos: Vec3            // центр (мировые координаты)
  size: Vec3          // полу-размеры (как у CuboidCollider)
  color: string
  blocksBeam?: boolean   // по умолчанию true; false → меш noRaycast (луч проходит, но коллайдер есть)
  rot?: Vec3           // Euler-поворот (радианы), напр. наклон рампы по X; по умолчанию нет
  shape?: 'box' | 'wedge'   // по умолчанию box; wedge — клин-рампа (треугольная призма)
  dir?: number         // сторона клина 0=+Z,1=+X,2=−Z,3=−X (поворот вокруг Y)
  flip?: boolean       // клин перевёрнут по Y (скос снизу — навес)
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
export function perimeter(color: string, hx: number, hz: number): MapBlock[] {
  const bb = false
  return [
    { pos: [0, WALL_H, -hz], size: [hx, WALL_H, WALL_T], color, blocksBeam: bb },
    { pos: [0, WALL_H, hz], size: [hx, WALL_H, WALL_T], color, blocksBeam: bb },
    { pos: [-hx, WALL_H, 0], size: [WALL_T, WALL_H, hz], color, blocksBeam: bb },
    { pos: [hx, WALL_H, 0], size: [WALL_T, WALL_H, hz], color, blocksBeam: bb },
  ]
}

// Карты собраны во встроенном редакторе (#editor) и лежат как данные в src/maps/*.json (форма GameMap).
export const MAPS: Record<MapId, GameMap> = {
  os_arena: os_arena as unknown as GameMap,
  os_india: os_india as unknown as GameMap,
  os_pillars: os_pillars as unknown as GameMap,
}

export const MAP_IDS: MapId[] = ['os_arena', 'os_india', 'os_pillars']

// Артефакты карт (опциональны — генерируются редактором при сохранении; бандлятся Vite, работают в проде).
// id извлекаем из пути '../maps/<id>/<file>'.
const idOf = (p: string): MapId => p.split('/').slice(-2, -1)[0] as MapId

/** Компил геометрии по id (geo.json). Нет файла → undefined → Arena компилирует из blocks (фолбэк). */
export const MAP_GEO: Partial<Record<MapId, CompiledMap>> = Object.fromEntries(
  Object.entries(import.meta.glob('../maps/*/geo.json', { eager: true }) as Record<string, { default: unknown }>)
    .map(([p, m]) => [idOf(p), parseGeo(m.default as never)]),
) as Partial<Record<MapId, CompiledMap>>

/** URL картинки превью по id (preview.png). Нет файла → undefined → живой превью-канвас (фолбэк). */
export const MAP_PREVIEW: Partial<Record<MapId, string>> = Object.fromEntries(
  Object.entries(import.meta.glob('../maps/*/preview.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
    .map(([p, url]) => [idOf(p), url]),
) as Partial<Record<MapId, string>>

/** Случайная точка в пределах игровой зоны — блуждание бота (без учёта препятствий; KCC не даёт пройти сквозь). */
export function randomArenaPos(): THREE.Vector3 {
  return new THREE.Vector3(
    (Math.random() - 0.5) * SPAWN_HALF * 2,
    1,
    (Math.random() - 0.5) * SPAWN_HALF * 2,
  )
}
