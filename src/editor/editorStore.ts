import { perimeter } from '../game/maps'
import type { MapBlock, Vec3 } from '../game/maps'

/**
 * Логика редактора карт (без React/THREE): воксельная модель, склейка в боксы, сериализация и localStorage.
 * Мир — однородные кубы ребром VOXEL на целочисленной сетке клеток (i,j,k): мировой центр клетки =
 * ((i+0.5)·S, (j+0.5)·S, (k+0.5)·S). Клетка k=0 лежит на полу (спан [0, S]).
 */
export const VOXEL = 1.0                         // ребро базового куба (small)
export const BRUSH: Record<'small' | 'medium' | 'large', number> = { small: 1, medium: 2, large: 4 }
export type BrushSize = keyof typeof BRUSH

const LS_KEY = 'oneshot:editor:maps'

/** Данные карты = форма GameMap (минус строгий id). Цвет стен не отдельным полем — периметр уже в blocks
 * (blocksBeam:false), его цвет оттуда и восстанавливаем при импорте. Так JSON чисто вставляется в maps.ts. */
export interface MapData {
  id?: string
  half: [number, number]      // полу-размеры пола [X, Z]
  floorColor: string
  blocks: MapBlock[]          // периметр (blocksBeam:false) + склеенные воксели-укрытия (blocksBeam:true)
  spawns: [Vec3, Vec3]
}

/** Цвет стен из блоков периметра (blocksBeam:false) — для редактора при импорте. */
export function wallColorOf(map: MapData, fallback = '#555'): string {
  return map.blocks.find(b => b.blocksBeam === false)?.color ?? fallback
}

export const cellKey = (x: number, y: number, z: number) => `${x},${y},${z}`
export const parseCellKey = (k: string): [number, number, number] =>
  k.split(',').map(Number) as [number, number, number]

/** Жадная склейка соседних одноцветных вокселей в крупные боксы (меньше мешей/коллайдеров в игре). */
export function greedyMerge(voxels: Map<string, string>): MapBlock[] {
  const S = VOXEL
  const visited = new Set<string>()
  const colorAt = (x: number, y: number, z: number) => voxels.get(cellKey(x, y, z))
  const free = (x: number, y: number, z: number, color: string) =>
    colorAt(x, y, z) === color && !visited.has(cellKey(x, y, z))
  const blocks: MapBlock[] = []

  for (const [k, color] of voxels) {
    if (visited.has(k)) continue
    const [x0, y0, z0] = parseCellKey(k)

    let x1 = x0
    while (free(x1 + 1, y0, z0, color)) x1++

    let y1 = y0
    for (;;) {
      let ok = true
      for (let x = x0; x <= x1; x++) if (!free(x, y1 + 1, z0, color)) { ok = false; break }
      if (!ok) break
      y1++
    }

    let z1 = z0
    for (;;) {
      let ok = true
      for (let x = x0; x <= x1 && ok; x++) for (let y = y0; y <= y1; y++) if (!free(x, y, z1 + 1, color)) { ok = false; break }
      if (!ok) break
      z1++
    }

    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) visited.add(cellKey(x, y, z))

    const min: Vec3 = [x0 * S, y0 * S, z0 * S]
    const max: Vec3 = [(x1 + 1) * S, (y1 + 1) * S, (z1 + 1) * S]
    blocks.push({
      pos: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
      size: [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2],
      color,
      blocksBeam: true,
    })
  }
  return blocks
}

/** Разобрать боксы карты обратно в воксели (берём только укрытия blocksBeam!==false; периметр пропускаем). */
export function voxelize(blocks: MapBlock[]): Map<string, string> {
  const S = VOXEL
  const v = new Map<string, string>()
  for (const b of blocks) {
    if (b.blocksBeam === false) continue   // периметр/декор — не воксель
    const x0 = Math.round((b.pos[0] - b.size[0]) / S), x1 = Math.round((b.pos[0] + b.size[0]) / S)
    const y0 = Math.round((b.pos[1] - b.size[1]) / S), y1 = Math.round((b.pos[1] + b.size[1]) / S)
    const z0 = Math.round((b.pos[2] - b.size[2]) / S), z1 = Math.round((b.pos[2] + b.size[2]) / S)
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) v.set(cellKey(x, y, z), b.color)
  }
  return v
}

/** Воксели + параметры → MapData (готова к игре: периметр из half + склеенные воксели). */
export function toMapData(
  voxels: Map<string, string>,
  opts: { half: [number, number]; floorColor: string; wallColor: string; spawns: [Vec3, Vec3]; id?: string },
): MapData {
  return {
    id: opts.id,
    half: opts.half,
    floorColor: opts.floorColor,
    blocks: [...perimeter(opts.wallColor, opts.half[0], opts.half[1]), ...greedyMerge(voxels)],
    spawns: opts.spawns,
  }
}

export function serializeMap(map: MapData): string {
  return JSON.stringify(map, null, 2)
}

/** Разбор JSON карты с валидацией формы; null при ошибке. */
export function parseMap(json: string): MapData | null {
  try {
    const m = JSON.parse(json)
    if (!m || !Array.isArray(m.half) || m.half.length !== 2) return null
    if (typeof m.floorColor !== 'string') return null
    if (!Array.isArray(m.blocks) || !Array.isArray(m.spawns) || m.spawns.length !== 2) return null
    return m as MapData
  } catch { return null }
}

// --- localStorage: именованный список сохранённых карт ---
type SavedMaps = Record<string, MapData>

function readAll(): SavedMaps {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as SavedMaps } catch { return {} }
}
export function listMaps(): string[] { return Object.keys(readAll()).sort() }
export function loadMap(name: string): MapData | null { return readAll()[name] ?? null }
export function saveMap(name: string, map: MapData): void {
  const all = readAll()
  all[name] = map
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)) } catch { /* квота/недоступно — игнор */ }
}
export function deleteMap(name: string): void {
  const all = readAll()
  delete all[name]
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)) } catch { /* игнор */ }
}
