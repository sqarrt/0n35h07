import { perimeter } from '../game/maps'
import type { MapBlock, Vec3 } from '../game/maps'
import { VOXEL } from '../constants'

/**
 * Map editor logic (no React/THREE): voxel model, box merging, serialization and localStorage.
 * The world is uniform cubes of edge VOXEL on an integer cell grid (i,j,k): world cell center =
 * ((i+0.5)·S, (j+0.5)·S, (k+0.5)·S). Cell k=0 sits on the floor (span [0, S]).
 */
export { VOXEL }                                 // base cube edge — single source in src/constants

// Block types and wedge orientation. dir: 0=+Z,1=+X,2=−Z,3=−X.
export type BlockType = 'cube' | 'wedge'
export type Dir = 0 | 1 | 2 | 3
// f — wedge flipped along Y; bb=blocksBeam (def. true=beam-blocking), tr=transparent (def. false), ps=passable (def. false)
export interface Cell { t: BlockType; c: string; d: Dir; f: boolean; bb: boolean; tr: boolean; ps: boolean }

/** Map data = GameMap shape (minus the strict id). Wall color is not a separate field — the perimeter is
 * already in blocks (perimeter:true), and we restore its color from there on import. So the JSON pastes
 * cleanly into maps.ts. */
export interface MapData {
  id?: string
  half: [number, number]      // floor half-sizes [X, Z]
  floorColor: string
  blocks: MapBlock[]          // perimeter (perimeter:true) + merged cover voxels
  spawns: [Vec3, Vec3]
  showBlockGrid?: boolean      // whether to draw the cube grid in-game (default no)
}

/** Wall color from perimeter blocks (perimeter:true) — for the editor on import. */
export function wallColorOf(map: MapData, fallback = '#555'): string {
  return map.blocks.find(b => b.perimeter === true)?.color ?? fallback
}

export const cellKey = (x: number, y: number, z: number) => `${x},${y},${z}`
export const parseCellKey = (k: string): [number, number, number] =>
  k.split(',').map(Number) as [number, number, number]

/** Cube attributes for merging: only cells with identical color and all flags get merged. */
export interface CubeAttrs { c: string; bb: boolean; tr: boolean; ps: boolean }
const sameAttrs = (a: CubeAttrs | undefined, b: CubeAttrs) => !!a && a.c === b.c && a.bb === b.bb && a.tr === b.tr && a.ps === b.ps

/** Greedy merge of adjacent identical (color+flags) voxels into larger boxes (fewer meshes/colliders in-game). */
export function greedyMerge(voxels: Map<string, CubeAttrs>): MapBlock[] {
  const S = VOXEL
  const visited = new Set<string>()
  const at = (x: number, y: number, z: number) => voxels.get(cellKey(x, y, z))
  const free = (x: number, y: number, z: number, a: CubeAttrs) => sameAttrs(at(x, y, z), a) && !visited.has(cellKey(x, y, z))
  const blocks: MapBlock[] = []

  for (const [k, a] of voxels) {
    if (visited.has(k)) continue
    const [x0, y0, z0] = parseCellKey(k)

    let x1 = x0
    while (free(x1 + 1, y0, z0, a)) x1++

    let y1 = y0
    for (;;) {
      let ok = true
      for (let x = x0; x <= x1; x++) if (!free(x, y1 + 1, z0, a)) { ok = false; break }
      if (!ok) break
      y1++
    }

    let z1 = z0
    for (;;) {
      let ok = true
      for (let x = x0; x <= x1 && ok; x++) for (let y = y0; y <= y1; y++) if (!free(x, y, z1 + 1, a)) { ok = false; break }
      if (!ok) break
      z1++
    }

    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) visited.add(cellKey(x, y, z))

    const min: Vec3 = [x0 * S, y0 * S, z0 * S]
    const max: Vec3 = [(x1 + 1) * S, (y1 + 1) * S, (z1 + 1) * S]
    const blk: MapBlock = {
      pos: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
      size: [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2],
      color: a.c,
      blocksBeam: a.bb,
    }
    if (a.tr) blk.transparent = true
    if (a.ps) blk.passable = true
    blocks.push(blk)
  }
  return blocks
}

const HALF = VOXEL / 2          // cube half-edge

/** Non-cube cell (wedge) → one prism MapBlock. */
export function shapeBlock(x: number, y: number, z: number, cell: Cell): MapBlock {
  const S = VOXEL
  const cx = (x + 0.5) * S, cy = (y + 0.5) * S, cz = (z + 0.5) * S
  const b: MapBlock = { pos: [cx, cy, cz], size: [HALF, HALF, HALF], color: cell.c, blocksBeam: cell.bb, shape: 'wedge', dir: cell.d }
  if (cell.f) b.flip = true
  if (cell.tr) b.transparent = true
  if (cell.ps) b.passable = true
  return b
}

/** Cover blocks (no perimeter): merged cubes + standalone shapes. For edge outlines and the game. */
export function coverBlocks(voxels: Map<string, Cell>): MapBlock[] {
  const cubes = new Map<string, CubeAttrs>()
  const shapes: MapBlock[] = []
  for (const [k, cell] of voxels) {
    if (cell.t === 'cube') cubes.set(k, { c: cell.c, bb: cell.bb, tr: cell.tr, ps: cell.ps })
    else { const [x, y, z] = parseCellKey(k); shapes.push(shapeBlock(x, y, z, cell)) }
  }
  return [...greedyMerge(cubes), ...shapes]
}

/** Voxels + params → MapData (game-ready: perimeter + merged cubes + standalone shapes). */
export function toMapData(
  voxels: Map<string, Cell>,
  opts: { half: [number, number]; floorColor: string; wallColor: string; spawns: [Vec3, Vec3]; id?: string; showBlockGrid?: boolean },
): MapData {
  return {
    id: opts.id,
    half: opts.half,
    floorColor: opts.floorColor,
    blocks: [...perimeter(opts.wallColor, opts.half[0], opts.half[1]), ...coverBlocks(voxels)],
    spawns: opts.spawns,
    ...(opts.showBlockGrid ? { showBlockGrid: true } : {}),
  }
}

// A stale "perimeter trim" duplicate: an old editor version emitted the perimeter as a wall PLUS an
// overlapping contrasting strip; that strip has no perimeter flag, so it used to round-trip back as
// fake voxels and re-appear as a doubled wall (z-fighting + double shadow). We drop such strips on
// import so they can't come back. Signature: an axis-aligned box at least half-buried in a perimeter
// wall AND running a long way along it (small decor flush to a wall stays — it's short, not a strip).
const STRIP_MIN_HALF = 2       // ≥ 4 voxels long along the wall (decor cubes are far shorter)
const STRIP_MAX_THIN_HALF = 0.3 // wall-thin (perimeter wall half-thickness is 0.25) — not a chunky structure
const STRIP_OVERLAP_FRAC = 0.25 // ≥ 25% of the strip's volume buried in a wall (decor flush to a wall barely overlaps)
const boxVol = (b: MapBlock) => 8 * b.size[0] * b.size[1] * b.size[2]
function overlapVol(a: MapBlock, c: MapBlock): number {
  const seg = (ap: number, ah: number, bp: number, bh: number) =>
    Math.max(0, Math.min(ap + ah, bp + bh) - Math.max(ap - ah, bp - bh))
  return seg(a.pos[0], a.size[0], c.pos[0], c.size[0])
    * seg(a.pos[1], a.size[1], c.pos[1], c.size[1])
    * seg(a.pos[2], a.size[2], c.pos[2], c.size[2])
}
/** True if `b` is a stale perimeter-wall trim duplicate (to be discarded on import): a long, wall-thin
 *  strip substantially buried in a perimeter wall. Short or chunky blocks, and decor merely flush to a
 *  wall (≈0% volume overlap), are kept. */
export function isPerimeterTrim(b: MapBlock, perimeterWalls: MapBlock[]): boolean {
  if (b.perimeter === true || b.shape === 'wedge' || b.rot) return false
  const longHalf = Math.max(b.size[0], b.size[2])
  const thinHalf = Math.min(b.size[0], b.size[2])
  if (longHalf < STRIP_MIN_HALF || thinHalf > STRIP_MAX_THIN_HALF) return false
  const vol = boxVol(b)
  return perimeterWalls.some(p => overlapVol(b, p) >= STRIP_OVERLAP_FRAC * vol)
}

/** Parse map blocks back into typed voxels (skip perimeter walls and their stale trim duplicates). */
export function voxelize(blocks: MapBlock[]): Map<string, Cell> {
  const S = VOXEL
  const v = new Map<string, Cell>()
  const perimeterWalls = blocks.filter(b => b.perimeter === true)
  for (const b of blocks) {
    if (b.perimeter === true) continue              // perimeter — not a voxel (drawn separately)
    if (isPerimeterTrim(b, perimeterWalls)) continue  // stale doubled-wall trim — drop so it can't return
    const bb = b.blocksBeam !== false, tr = b.transparent === true, ps = b.passable === true
    if (b.shape === 'wedge') {                      // wedge (sub-cell prism)
      const [x, y, z] = [
        Math.floor((b.pos[0] - b.size[0] + 1e-3) / S),
        Math.floor((b.pos[1] - b.size[1] + 1e-3) / S),
        Math.floor((b.pos[2] - b.size[2] + 1e-3) / S),
      ]
      v.set(cellKey(x, y, z), { t: 'wedge', c: b.color, d: (b.dir ?? 0) as Dir, f: !!b.flip, bb, tr, ps })
      continue
    }
    // cube / merged cube-box → fill the cells
    const [sx, sy, sz] = b.size
    const x0 = Math.round((b.pos[0] - sx) / S), x1 = Math.round((b.pos[0] + sx) / S)
    const y0 = Math.round((b.pos[1] - sy) / S), y1 = Math.round((b.pos[1] + sy) / S)
    const z0 = Math.round((b.pos[2] - sz) / S), z1 = Math.round((b.pos[2] + sz) / S)
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
      v.set(cellKey(x, y, z), { t: 'cube', c: b.color, d: 0, f: false, bb, tr, ps })
    }
  }
  return v
}

export function serializeMap(map: MapData): string {
  return JSON.stringify(map, null, 2)
}

/** Parse map JSON with shape validation; null on error. */
export function parseMap(json: string): MapData | null {
  try {
    const m = JSON.parse(json)
    if (!m || !Array.isArray(m.half) || m.half.length !== 2) return null
    if (typeof m.floorColor !== 'string') return null
    if (!Array.isArray(m.blocks) || !Array.isArray(m.spawns) || m.spawns.length !== 2) return null
    return m as MapData
  } catch { return null }
}
