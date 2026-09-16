/**
 * Maps as data — the shape the editor writes and the Godot game reads (`maps/<id>.json`, read by
 * `nodes/map_files.gd` and `nodes/geo_loader.gd`). Restored from the web game's `src/game/maps.ts`; the registry that
 * bundled the maps into the web build is gone — here a map is whatever the bridge hands over from the game's `maps/`
 * folder, so the id is a plain string.
 *
 * A block = a box: a visible mesh plus a collider (half-extents = size). `blocksBeam` (default true) — whether the
 * beam raycast hits it: cover and columns block the line of fire (true), perimeter walls are decor + collider and the
 * beam passes through (false). The floor is drawn by the arena separately.
 *
 * Spawns are two eye-level anchor points facing each other along ±Z; the mode's spawn rule (the game's
 * `sim/spawns.gd`) maps seats onto them. Jump height ≈ JUMP_FORCE²/(2·|GRAVITY|) ≈ 1.45 — platforms are not taller,
 * so they stay reachable by a jump.
 */

export type Vec3 = [number, number, number]

export interface MapBlock {
  pos: Vec3            // center (world coordinates)
  size: Vec3          // half-extents (like CuboidCollider)
  color: string
  blocksBeam?: boolean   // default true; false → noRaycast mesh (beam passes through, but a collider exists)
  rot?: Vec3           // Euler rotation (radians), e.g. ramp tilt around X; none by default
  shape?: 'box' | 'wedge'   // default box; wedge — a wedge ramp (triangular prism)
  dir?: number         // wedge side 0=+Z,1=+X,2=−Z,3=−X (rotation around Y)
  flip?: boolean       // wedge flipped along Y (slope underneath — an overhang)
  side?: boolean       // wedge laid on its side — vertical diagonal wall; ignores flip
  transparent?: boolean   // default false → opaque; true → semi-transparent
  passable?: boolean      // default false → has a collider; true → no collider (passable through)
  perimeter?: boolean     // editor-round-trip marker for a perimeter wall; the game ignores it
}

export interface GameMap {
  id: string           // the map's file name in the game's maps/ folder, and its label
  half: [number, number]   // arena floor half-extents [X, Z] — a map can be rectangular (longer along Z)
  floorColor: string
  blocks: MapBlock[]
  spawns: [Vec3, Vec3]   // the two anchor points (see the header comment)
  showBlockGrid?: boolean   // draw the cube grid in-game (default/absent — don't draw)
}

const WALL_H = 1.5       // perimeter wall half-height
const WALL_T = 0.25      // wall half-thickness

/** Four perimeter walls sized to the floor [hx, hz] (decor+collider, beam passes through). Walls sit ENTIRELY
 *  OUTSIDE the floor: centered at ±(half + WALL_T), so the inner face lands exactly on the arena edge (±half,
 *  a grid node). Then the last row of voxel cells abuts the wall with no overlap — the grid fits tile-perfect
 *  and border blocks aren't misread as buried "perimeter trim". */
export function perimeter(color: string, hx: number, hz: number): MapBlock[] {
  const bb = false
  return [
    { pos: [0, WALL_H, -(hz + WALL_T)], size: [hx, WALL_H, WALL_T], color, blocksBeam: bb, perimeter: true },
    { pos: [0, WALL_H, hz + WALL_T], size: [hx, WALL_H, WALL_T], color, blocksBeam: bb, perimeter: true },
    { pos: [-(hx + WALL_T), WALL_H, 0], size: [WALL_T, WALL_H, hz], color, blocksBeam: bb, perimeter: true },
    { pos: [hx + WALL_T, WALL_H, 0], size: [WALL_T, WALL_H, hz], color, blocksBeam: bb, perimeter: true },
  ]
}
