import { cellKey, parseCellKey, VOXEL } from './editorStore'
import type { Cell, Dir } from './editorStore'

/**
 * Selection/clipboard logic for the map editor (no React/THREE): an axis-aligned box of cells
 * between two corner cells, copied into a Fragment with coordinates relative to the box min corner.
 * All functions are pure and return new Maps (same convention as editorStore).
 */

export type Vec3i = [number, number, number]

/** Clipboard fragment: region bbox extents in cells + non-empty cells at coords relative to (0,0,0) = min corner. */
export interface Fragment { size: Vec3i; cells: Map<string, Cell> }

/** Normalized region corners (inputs in any order). */
export function regionBounds(a: Vec3i, b: Vec3i): { min: Vec3i; max: Vec3i } {
  return {
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  }
}

const inRegion = (x: number, y: number, z: number, min: Vec3i, max: Vec3i) =>
  x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2]

/** Copy the non-empty cells of the region into a Fragment (cells keep their Cell objects — Cell is immutable by convention). */
export function extractRegion(voxels: Map<string, Cell>, a: Vec3i, b: Vec3i): Fragment {
  const { min, max } = regionBounds(a, b)
  const cells = new Map<string, Cell>()
  for (const [k, cell] of voxels) {
    const [x, y, z] = parseCellKey(k)
    if (inRegion(x, y, z, min, max)) cells.set(cellKey(x - min[0], y - min[1], z - min[2]), cell)
  }
  return { size: [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1], cells }
}

/** 90° rotation about the vertical axis: relative (x,z) → (nz−1−z, x) — the same −90° world turn that
 *  one `d` step encodes (wedgeRotationY = −d·90°), so wedges stay consistent with their cells: d' = (d+1)&3. */
export function rotateFragment(frag: Fragment): Fragment {
  const [nx, ny, nz] = frag.size
  const cells = new Map<string, Cell>()
  for (const [k, cell] of frag.cells) {
    const [x, y, z] = parseCellKey(k)
    const next: Cell = cell.t === 'wedge' ? { ...cell, d: ((cell.d + 1) & 3) as Dir } : cell
    cells.set(cellKey(nz - 1 - z, y, x), next)
  }
  return { size: [nz, ny, nx], cells }
}

const BOUNDS_EPS = 1e-6

/** Cell (x,·,z) lies inside the arena floor [−hx,hx]×[−hz,hz]. */
const cellInArena = (x: number, z: number, half: [number, number]) =>
  x * VOXEL >= -half[0] - BOUNDS_EPS && (x + 1) * VOXEL <= half[0] + BOUNDS_EPS &&
  z * VOXEL >= -half[1] - BOUNDS_EPS && (z + 1) * VOXEL <= half[1] + BOUNDS_EPS

/** Paste validity: every fragment cell must land on a free cell inside the arena (and not below the floor). */
export function canStamp(voxels: Map<string, Cell>, frag: Fragment, anchor: Vec3i, half: [number, number]): boolean {
  for (const k of frag.cells.keys()) {
    const [x, y, z] = parseCellKey(k)
    const wx = anchor[0] + x, wy = anchor[1] + y, wz = anchor[2] + z
    if (wy < 0 || !cellInArena(wx, wz, half) || voxels.has(cellKey(wx, wy, wz))) return false
  }
  return true
}

/** Stamp the fragment with its min corner at `anchor`. Returns a new Map. */
export function stampFragment(voxels: Map<string, Cell>, frag: Fragment, anchor: Vec3i): Map<string, Cell> {
  const next = new Map(voxels)
  for (const [k, cell] of frag.cells) {
    const [x, y, z] = parseCellKey(k)
    next.set(cellKey(anchor[0] + x, anchor[1] + y, anchor[2] + z), cell)
  }
  return next
}

/** Remove every cell inside the region. Returns a new Map. */
export function eraseRegion(voxels: Map<string, Cell>, a: Vec3i, b: Vec3i): Map<string, Cell> {
  const { min, max } = regionBounds(a, b)
  const next = new Map(voxels)
  for (const k of voxels.keys()) {
    const [x, y, z] = parseCellKey(k)
    if (inRegion(x, y, z, min, max)) next.delete(k)
  }
  return next
}

/** Патч свойств блока (без типа/ориентации) — то, что задаёт кисть хотбара. */
export type RegionPatch = Partial<Pick<Cell, 'c' | 'bb' | 'tr' | 'ps'>>

/** Применить патч ко всем ячейкам региона (t/d/f сохранены). Новая Map. */
export function patchRegion(voxels: Map<string, Cell>, a: Vec3i, b: Vec3i, patch: RegionPatch): Map<string, Cell> {
  const { min, max } = regionBounds(a, b)
  const next = new Map(voxels)
  for (const [k, cell] of voxels) {
    const [x, y, z] = parseCellKey(k)
    if (inRegion(x, y, z, min, max)) next.set(k, { ...cell, ...patch })
  }
  return next
}
