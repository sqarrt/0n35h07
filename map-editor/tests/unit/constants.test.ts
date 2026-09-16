import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EYE_HEIGHT, JUMP_FORCE, GRAVITY, AUTOSTEP_MAX_HEIGHT, VOXEL } from '../../src/constants'

/**
 * The game owns these numbers (`sim/constants.gd` for movement, `sim/block_grid.gd` for the voxel edge) — the editor
 * keeps a copy so its walk mode and its grid behave like a match. This test reads the GDScript and fails the moment
 * the two drift apart.
 */
const gd = (file: string): string => readFileSync(new URL(`../../../sim/${file}`, import.meta.url), 'utf8')

function gdConst(file: string, name: string): number {
  const match = gd(file).match(new RegExp(`^const ${name} := (-?[0-9.]+)`, 'm'))
  if (!match) throw new Error(`sim/${file} has no ${name}`)
  return Number(match[1])
}

describe('the numbers shared with the game', () => {
  it.each([
    ['constants.gd', 'EYE_HEIGHT', EYE_HEIGHT],
    ['constants.gd', 'JUMP_FORCE', JUMP_FORCE],
    ['constants.gd', 'GRAVITY', GRAVITY],
    ['constants.gd', 'AUTOSTEP_MAX_HEIGHT', AUTOSTEP_MAX_HEIGHT],
    ['block_grid.gd', 'VOXEL', VOXEL],   // the grid the game draws from the same cells
  ])('%s %s matches the game', (file, name, here) => {
    expect(gdConst(file, name)).toBe(here)
  })
})
