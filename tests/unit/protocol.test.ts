import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { toVec3, fromVec3, applyVec3 } from '../../src/net/protocol'
import type { Snapshot } from '../../src/net/protocol'

describe('protocol Vec3', () => {
  it('toVec3/fromVec3 — roundtrip THREE.Vector3', () => {
    const v = new THREE.Vector3(1.5, -2.25, 3)
    const back = fromVec3(toVec3(v))
    expect(back.x).toBeCloseTo(1.5)
    expect(back.y).toBeCloseTo(-2.25)
    expect(back.z).toBeCloseTo(3)
  })

  it('applyVec3 пишет в существующий вектор без аллокации', () => {
    const out = new THREE.Vector3()
    const r = applyVec3([4, 5, 6], out)
    expect(r).toBe(out)
    expect(out.toArray()).toEqual([4, 5, 6])
  })

  it('Snapshot JSON-сериализуем (без THREE-объектов)', () => {
    const snap: Snapshot = {
      ackSeq: 7,
      players: [{ id: 0, pos: [0, 1.7, 5], aimDir: [0, 0, -1], alive: true, shieldActive: false, dashing: false, windupProgress: 0 }],
    }
    const round = JSON.parse(JSON.stringify(snap)) as Snapshot
    expect(round).toEqual(snap)
  })
})
