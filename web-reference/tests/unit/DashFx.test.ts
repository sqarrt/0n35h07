import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { WaveTrail } from '../../src/game/fx/dash/WaveTrail'
import { RiftTrail } from '../../src/game/fx/dash/RiftTrail'
import { createDashFx } from '../../src/game/fx/dash/createDashFx'
import { AfterimageTrail } from '../../src/game/fx/AfterimageTrail'
import type { IDashTrail } from '../../src/game/abstractions'

const COLOR = '#4fa'
const STEP = 1 / 60

/** Runs a dash: position travels along +X, dashing=true, for durMs milliseconds. */
function runDash(trail: IDashTrail, durMs: number) {
  const pos = new THREE.Vector3(0, 1.7, 0)
  for (let t = 0; t < durMs / 1000; t += STEP) {
    pos.x += 24 * STEP
    trail.update(STEP, { position: pos, dashing: true })
  }
}

/** Burns time without a dash (elements should fade out). */
function runIdle(trail: IDashTrail, durMs: number) {
  const pos = new THREE.Vector3(0, 1.7, 0)
  for (let t = 0; t < durMs / 1000; t += STEP) {
    trail.update(STEP, { position: pos, dashing: false })
  }
}

function visibleMeshes(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  root.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) out.push(o) })
  return out
}

for (const [name, make] of [
  ['wave', () => new WaveTrail(COLOR)],
  ['rift', () => new RiftTrail(COLOR)],
] as const) {
  describe(`${name}Trail`, () => {
    it('visible elements appear during the dash, fade out without a dash', () => {
      const trail = make()
      runDash(trail, 150)
      expect(trail.aliveCount).toBeGreaterThan(0)
      expect(visibleMeshes(trail.object3d).length).toBeGreaterThan(0)
      runIdle(trail, 800)
      expect(trail.aliveCount).toBe(0)
      expect(visibleMeshes(trail.object3d)).toHaveLength(0)
    })

    it('emit is throttled: at most one element/group per frame', () => {
      const trail = make()
      const pos = new THREE.Vector3(0, 1.7, 0)
      trail.update(STEP, { position: pos, dashing: true })
      const after1 = trail.aliveCount
      expect(after1).toBeGreaterThan(0)
      pos.x += 24 * STEP
      trail.update(STEP, { position: pos, dashing: true })   // 16ms < emit interval
      expect(trail.aliveCount).toBe(after1)
    })

    it('meshes marked noRaycast; dispose does not throw', () => {
      const trail = make()
      runDash(trail, 100)
      trail.object3d.traverse(o => {
        if ((o as THREE.Mesh).isMesh) expect(o.userData.noRaycast).toBe(true)
      })
      expect(() => trail.dispose()).not.toThrow()
    })
  })
}

describe('createDashFx', () => {
  it('creates the implementation for the style', () => {
    expect(createDashFx('streak', COLOR)).toBeInstanceOf(AfterimageTrail)
    expect(createDashFx('wave', COLOR)).toBeInstanceOf(WaveTrail)
    expect(createDashFx('rift', COLOR)).toBeInstanceOf(RiftTrail)
  })
})
