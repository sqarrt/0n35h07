import { perimeter } from '../game/maps'
import type { MapBlock, Vec3 } from '../game/maps'

/**
 * Логика редактора карт (без React/THREE): воксельная модель, склейка в боксы, сериализация и localStorage.
 * Мир — однородные кубы ребром VOXEL на целочисленной сетке клеток (i,j,k): мировой центр клетки =
 * ((i+0.5)·S, (j+0.5)·S, (k+0.5)·S). Клетка k=0 лежит на полу (спан [0, S]).
 */
export const VOXEL = 0.5                         // ребро базового куба

// Типы блоков и ориентация клина. dir: 0=+Z,1=+X,2=−Z,3=−X.
export type BlockType = 'cube' | 'wedge'
export type Dir = 0 | 1 | 2 | 3
export interface Cell { t: BlockType; c: string; d: Dir; f: boolean }   // f — клин перевёрнут по Y

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

const HALF = VOXEL / 2          // полу-ребро куба

/** Не-кубовая ячейка (клин) → один MapBlock-призма. */
export function shapeBlock(x: number, y: number, z: number, cell: Cell): MapBlock {
  const S = VOXEL
  const cx = (x + 0.5) * S, cy = (y + 0.5) * S, cz = (z + 0.5) * S
  const b: MapBlock = { pos: [cx, cy, cz], size: [HALF, HALF, HALF], color: cell.c, blocksBeam: true, shape: 'wedge', dir: cell.d }
  if (cell.f) b.flip = true
  return b
}

/** Блоки-укрытия (без периметра): склеенные кубы + отдельные формы. Для контура рёбер и игры. */
export function coverBlocks(voxels: Map<string, Cell>): MapBlock[] {
  const cubes = new Map<string, string>()
  const shapes: MapBlock[] = []
  for (const [k, cell] of voxels) {
    if (cell.t === 'cube') cubes.set(k, cell.c)
    else { const [x, y, z] = parseCellKey(k); shapes.push(shapeBlock(x, y, z, cell)) }
  }
  return [...greedyMerge(cubes), ...shapes]
}

/** Воксели + параметры → MapData (готова к игре: периметр + склеенные кубы + отдельные формы). */
export function toMapData(
  voxels: Map<string, Cell>,
  opts: { half: [number, number]; floorColor: string; wallColor: string; spawns: [Vec3, Vec3]; id?: string },
): MapData {
  return {
    id: opts.id,
    half: opts.half,
    floorColor: opts.floorColor,
    blocks: [...perimeter(opts.wallColor, opts.half[0], opts.half[1]), ...coverBlocks(voxels)],
    spawns: opts.spawns,
  }
}

/** Разобрать блоки карты обратно в типизированные воксели (периметр blocksBeam:false пропускаем). */
export function voxelize(blocks: MapBlock[]): Map<string, Cell> {
  const S = VOXEL
  const v = new Map<string, Cell>()
  for (const b of blocks) {
    if (b.blocksBeam === false) continue
    if (b.shape === 'wedge') {                      // клин (под-клеточная призма)
      const [x, y, z] = [
        Math.floor((b.pos[0] - b.size[0] + 1e-3) / S),
        Math.floor((b.pos[1] - b.size[1] + 1e-3) / S),
        Math.floor((b.pos[2] - b.size[2] + 1e-3) / S),
      ]
      v.set(cellKey(x, y, z), { t: 'wedge', c: b.color, d: (b.dir ?? 0) as Dir, f: !!b.flip })
      continue
    }
    // куб / склеенный куб-бокс → заполнить клетки
    const [sx, sy, sz] = b.size
    const x0 = Math.round((b.pos[0] - sx) / S), x1 = Math.round((b.pos[0] + sx) / S)
    const y0 = Math.round((b.pos[1] - sy) / S), y1 = Math.round((b.pos[1] + sy) / S)
    const z0 = Math.round((b.pos[2] - sz) / S), z1 = Math.round((b.pos[2] + sz) / S)
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
      v.set(cellKey(x, y, z), { t: 'cube', c: b.color, d: 0, f: false })
    }
  }
  return v
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
