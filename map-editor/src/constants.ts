/**
 * The handful of numbers the editor shares with the game. The game owns them (`sim/constants.gd`, class MoveConst);
 * this file is the copy the editor's walk mode and grid run on, and `tests/unit/constants.test.ts` reads the GDScript
 * and fails if the two drift apart.
 */

// Player movement — the editor's walk mode feels like a match.
export const EYE_HEIGHT = 1.7
export const JUMP_FORCE = 8
export const GRAVITY    = -22

// KCC: autostep. Step height ≥ the height of a 1×1 block (=1.0) → walls of that size are climbed like stairs.
export const AUTOSTEP_MAX_HEIGHT = 1.05

export const BLOCK_TRANSPARENT_OPACITY = 0.2   // opacity of translucent map blocks (game / editor / trailer)
export const VOXEL = 0.5   // edge of the base map cube — the grid the editor and the game's cube grid share
