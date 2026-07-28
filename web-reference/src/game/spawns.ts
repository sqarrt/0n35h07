import type { Vec3 } from '../net/protocol'
import type { GameMode } from './modes'
import { teamOfSlot } from './modes'
import { SPAWN_CLUSTER_OFFSETS, FFA_SPAWN_MIN_DIST, SPAWN_HALF } from '../constants'

const FFA_SPAWN_MAX_TRIES = 200   // rejection-sampling cap; after it, the farthest candidate found is accepted

/** Start positions by slot. 1v1 — the two map points as today; 2v2 — team clusters at the two points;
 *  FFA — host-generated positions (shipped in Start) applied in slot order. */
export function spawnPositionsFor(mode: GameMode, slots: number[], mapSpawns: readonly [Vec3, Vec3], ffaSpawns?: Vec3[]): Map<number, Vec3> {
  const out = new Map<number, Vec3>()
  if (mode === 'ffa' && ffaSpawns) {
    slots.forEach((slot, i) => out.set(slot, ffaSpawns[i] ?? mapSpawns[i % 2]))
    return out
  }
  if (mode === '2v2') {
    const seen = [0, 0]   // members already placed per team → offset index within the cluster
    for (const slot of slots) {
      const team = teamOfSlot(mode, slot)
      const base = mapSpawns[team]
      const [ox, oz] = SPAWN_CLUSTER_OFFSETS[seen[team]++ % SPAWN_CLUSTER_OFFSETS.length]
      out.set(slot, [base[0] + ox, base[1], base[2] + oz])
    }
    return out
  }
  // 1v1 (and an FFA fallback without shipped positions): slot 0 → point 0, others → point 1 — the pre-modes rule.
  for (const slot of slots) out.set(slot, mapSpawns[slot === 0 ? 0 : 1])
  return out
}

/** Random FFA start positions: inside the arena square, min pairwise distance. Runs on the LOBBY CREATOR only;
 *  the result ships in the Start message so every peer gets identical positions without a shared RNG. */
export function genFfaSpawns(count: number, y: number, rng: () => number = Math.random): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i < count; i++) {
    let best: Vec3 = [0, y, 0]
    let bestNear = -1
    for (let t = 0; t < FFA_SPAWN_MAX_TRIES; t++) {
      const c: Vec3 = [(rng() * 2 - 1) * SPAWN_HALF, y, (rng() * 2 - 1) * SPAWN_HALF]
      const near = pts.length ? Math.min(...pts.map(p => Math.hypot(c[0] - p[0], c[2] - p[2]))) : Infinity
      if (near > bestNear) { best = c; bestNear = near }
      if (near >= FFA_SPAWN_MIN_DIST) break   // good enough — take it (the first point always is)
    }
    pts.push(best)
  }
  return pts
}
