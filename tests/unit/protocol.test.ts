import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { toVec3, fromVec3, applyVec3, NET_TAGS } from '../../src/net/protocol'
import type { Snapshot, RosterEntry, Assign, Start, SetSlotMsg, HitClaim, MatchEvent } from '../../src/net/protocol'

describe('protocol Vec3', () => {
  it('toVec3/fromVec3 — roundtrip THREE.Vector3', () => {
    const v = new THREE.Vector3(1.5, -2.25, 3)
    const back = fromVec3(toVec3(v))
    expect(back.x).toBeCloseTo(1.5)
    expect(back.y).toBeCloseTo(-2.25)
    expect(back.z).toBeCloseTo(3)
  })

  it('applyVec3 writes into an existing vector without allocating', () => {
    const out = new THREE.Vector3()
    const r = applyVec3([4, 5, 6], out)
    expect(r).toBe(out)
    expect(out.toArray()).toEqual([4, 5, 6])
  })

  it('Snapshot is JSON-serializable (no THREE objects)', () => {
    const snap: Snapshot = {
      tick: 7,
      players: [{ id: 0, pos: [0, 1.7, 5], aimDir: [0, 0, -1], alive: true, shieldActive: false, dashing: false, windupProgress: 0, respawning: false }],
    }
    const round = JSON.parse(JSON.stringify(snap)) as Snapshot
    expect(round).toEqual(snap)
  })

  it('mode / setSlot / ffa-spawns shapes', () => {
    const a: Assign = { yourId: 2, roster: [], durationMin: 5, mapId: 'os_arena', ready: [], mode: '2v2', owners: { 0: 'H' }, seed: 'ROOM42' }
    const s: Start = { durationMs: 60000, mapId: 'os_arena', spawns: [[1, 1, 1]], owners: { 0: 'H' } }
    const m: SetSlotMsg = { slot: 3 }
    expect(a.mode).toBe('2v2')
    expect(s.spawns![0][1]).toBe(1)
    expect(m.slot).toBe(3)
    expect(NET_TAGS).toContain('setSlot')
  })

  it('mesh shapes: owners maps, shooter in HitClaim, ready event', () => {
    const a: Assign = { yourId: 1, roster: [], durationMin: 5, mapId: 'os_arena', ready: [], mode: 'ffa', owners: { 0: 'H', 1: 'C' }, seed: 'ROOM42' }
    const s: Start = { durationMs: 60000, mapId: 'os_arena', owners: { 0: 'H', 1: 'C', 2: 'H' } }
    const c: HitClaim = { shooter: 2, hitId: 1, point: [0, 1, 0], end: [0, 1, -5] }
    const r: MatchEvent = { t: 'ready', id: 3 }
    expect(a.owners[1]).toBe('C')
    expect(a.seed).toBe('ROOM42')   // the creator's shared seed reaches every peer via assign
    expect(s.owners[2]).toBe('H')   // the creator owns the bots
    expect(c.shooter).toBe(2)
    expect(r.t).toBe('ready')
  })

  it('ballArt survives a JSON round-trip in RosterEntry', () => {
    const e: RosterEntry = { id: 0, name: 'A', color: '#4af', kind: 'human', ballArt: 'x'.repeat(88) }
    expect((JSON.parse(JSON.stringify(e)) as RosterEntry).ballArt).toBe('x'.repeat(88))
  })
})
