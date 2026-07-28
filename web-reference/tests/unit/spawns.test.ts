import { describe, it, expect } from 'vitest'
import { spawnPositionsFor, genFfaSpawns } from '../../src/game/spawns'
import { FFA_SPAWN_MIN_DIST, SPAWN_HALF } from '../../src/constants'
import type { Vec3 } from '../../src/net/protocol'

const MAP_SPAWNS: [Vec3, Vec3] = [[0, 1, 5], [0, 1, -5]]
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2])

describe('spawnPositionsFor', () => {
  it('1v1: slot 0 → point 0, slot 1 → point 1 (exactly the current game)', () => {
    const m = spawnPositionsFor('1v1', [0, 1], MAP_SPAWNS)
    expect(m.get(0)).toEqual([0, 1, 5])
    expect(m.get(1)).toEqual([0, 1, -5])
  })

  it('2v2: team 0 clusters at point 0, team 1 at point 1; no two positions coincide', () => {
    const m = spawnPositionsFor('2v2', [0, 1, 2, 3], MAP_SPAWNS)
    for (const s of [0, 1]) expect(dist(m.get(s)!, MAP_SPAWNS[0])).toBeLessThan(3)
    for (const s of [2, 3]) expect(dist(m.get(s)!, MAP_SPAWNS[1])).toBeLessThan(3)
    const all = [...m.values()]
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) expect(dist(all[i], all[j])).toBeGreaterThan(0.5)
  })

  it('ffa: uses the provided positions in slot order', () => {
    const ffa: Vec3[] = [[1, 1, 1], [2, 1, 2], [3, 1, 3]]
    const m = spawnPositionsFor('ffa', [0, 2, 3], MAP_SPAWNS, ffa)
    expect(m.get(0)).toEqual([1, 1, 1])
    expect(m.get(2)).toEqual([2, 1, 2])
    expect(m.get(3)).toEqual([3, 1, 3])
  })
})

describe('genFfaSpawns', () => {
  it('respects the min pairwise distance and arena bounds (seeded rng)', () => {
    let s = 42
    const rng = () => (s = (s * 16807) % 2147483647) / 2147483647
    const pts = genFfaSpawns(4, 1, rng)
    expect(pts).toHaveLength(4)
    for (const p of pts) {
      expect(Math.abs(p[0])).toBeLessThanOrEqual(SPAWN_HALF)
      expect(Math.abs(p[2])).toBeLessThanOrEqual(SPAWN_HALF)
      expect(p[1]).toBe(1)
    }
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) expect(dist(pts[i], pts[j])).toBeGreaterThanOrEqual(FFA_SPAWN_MIN_DIST)
  })
})
