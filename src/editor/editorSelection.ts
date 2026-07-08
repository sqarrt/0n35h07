import { cellKey, parseCellKey } from './editorStore'
import type { Cell } from './editorStore'

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
