import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { ClassicBeamFx } from '../../src/game/fx/beam/ClassicBeamFx'
import { RageBeamFx } from '../../src/game/fx/beam/RageBeamFx'
import { SingularityBeamFx } from '../../src/game/fx/beam/SingularityBeamFx'
import { createBeamFx } from '../../src/game/fx/beam/createBeamFx'
import type { IBeamFx } from '../../src/game/fx/beam/types'
import { BEAM_DURATION } from '../../src/constants'

const start = new THREE.Vector3(0, 1, 0)
const end = new THREE.Vector3(0, 1, -10)

/** Whether the subtree has a visible mesh with a visible parent chain (up to root). */
export function anyVisible(root: THREE.Object3D): boolean {
  let found = false
  root.traverse(o => {
    if (!(o as THREE.Mesh).isMesh || !o.visible) return
    let p = o.parent
    while (p && p !== root) { if (!p.visible) return; p = p.parent }
    found = true
  })
  return found
}

/** Run update in small steps, advancing totalMs forward. */
export function advanceFx(fx: IBeamFx, totalMs: number, stepMs = 16) {
  for (let t = 0; t < totalMs; t += stepMs) fx.update(stepMs / 1000)
}

describe('ClassicBeamFx', () => {
  it('nothing visible before play', () => {
    const fx = new ClassicBeamFx()
    fx.update(0.016)
    expect(anyVisible(fx.object3d)).toBe(false)
  })

  it('play → beam visible; after BEAM_DURATION + afterglow — gone', () => {
    const fx = new ClassicBeamFx('white', '#4af')
    fx.play(start, end)
    fx.update(0.016)
    expect(anyVisible(fx.object3d)).toBe(true)
    advanceFx(fx, BEAM_DURATION + 1000)   // margin for afterglow fade-out
    expect(anyVisible(fx.object3d)).toBe(false)
  })

  it('reset clears instantly', () => {
    const fx = new ClassicBeamFx()
    fx.play(start, end)
    fx.update(0.016)
    fx.reset()
    expect(anyVisible(fx.object3d)).toBe(false)
  })

  it('all meshes noRaycast, dispose does not throw', () => {
    const fx = new ClassicBeamFx()
    let meshes = 0
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh) { meshes++; expect(o.userData.noRaycast).toBe(true) } })
    expect(meshes).toBeGreaterThan(0)
    expect(() => fx.dispose()).not.toThrow()
  })
})

describe('RageBeamFx', () => {
  it('not visible before play; play → visible; gone by BEAM_DURATION', () => {
    const fx = new RageBeamFx('#4af')
    fx.update(0.016)
    expect(anyVisible(fx.object3d)).toBe(false)
    fx.play(start, end)
    fx.update(0.016)
    expect(anyVisible(fx.object3d)).toBe(true)
    advanceFx(fx, BEAM_DURATION + 100)
    expect(anyVisible(fx.object3d)).toBe(false)
  })

  it('segments lie along the shot line, offset within the jitter limit', () => {
    const fx = new RageBeamFx('#4af')
    fx.play(start, end)
    fx.update(0.016)
    // Shot line — along -Z at height y=1: every visible segment has x/y close to the line.
    fx.object3d.traverse(o => {
      if (!(o as THREE.Mesh).isMesh || !o.visible) return
      const w = o.getWorldPosition(new THREE.Vector3())
      expect(Math.abs(w.x)).toBeLessThan(1)                  // lateral jitter is bounded
      expect(Math.abs(w.y - 1)).toBeLessThan(1)
      expect(w.z).toBeLessThanOrEqual(0.1)                   // between start and end
      expect(w.z).toBeGreaterThanOrEqual(-10.1)
    })
  })

  it('reset clears instantly; meshes noRaycast; dispose does not throw', () => {
    const fx = new RageBeamFx('#4af')
    fx.play(start, end)
    fx.update(0.016)
    fx.reset()
    expect(anyVisible(fx.object3d)).toBe(false)
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh) expect(o.userData.noRaycast).toBe(true) })
    expect(() => fx.dispose()).not.toThrow()
  })
})

describe('SingularityBeamFx', () => {
  it('not visible before play; play → visible (thread + spiral); gone by BEAM_DURATION', () => {
    const fx = new SingularityBeamFx('#4af')
    fx.update(0.016)
    expect(anyVisible(fx.object3d)).toBe(false)
    fx.play(start, end)
    fx.update(0.016)
    expect(anyVisible(fx.object3d)).toBe(true)
    advanceFx(fx, BEAM_DURATION + 100)
    expect(anyVisible(fx.object3d)).toBe(false)
  })

  it('"retract" fade-out: by mid-life the thread is shorter than full length and pulled to the muzzle', () => {
    const fx = new SingularityBeamFx('#4af')
    fx.play(start, end)
    fx.update(0.016)
    const core = fx.object3d.children[0] as THREE.Mesh    // children[0] — core thread (add order in the constructor)
    const fullLen = core.scale.y
    advanceFx(fx, BEAM_DURATION * 0.6)
    expect(core.scale.y).toBeLessThan(fullLen)            // thread shrinks
    // Thread center shifts toward the start (muzzle): distance from start is less than half the full length.
    const mid = core.getWorldPosition(new THREE.Vector3())
    expect(mid.distanceTo(start)).toBeLessThan(fullLen / 2)
  })

  it('spiral particles and meshes noRaycast; reset clears; dispose does not throw', () => {
    const fx = new SingularityBeamFx('#4af')
    fx.object3d.traverse(o => { if (o !== fx.object3d) expect(o.userData.noRaycast).toBe(true) })
    fx.play(start, end)
    fx.update(0.016)
    fx.reset()
    expect(anyVisible(fx.object3d)).toBe(false)
    expect(() => fx.dispose()).not.toThrow()
  })
})

describe('createBeamFx', () => {
  it('returns the implementation for the style', () => {
    expect(createBeamFx('classic', '#4af')).toBeInstanceOf(ClassicBeamFx)
    expect(createBeamFx('rage', '#4af')).toBeInstanceOf(RageBeamFx)
    expect(createBeamFx('singularity', '#4af')).toBeInstanceOf(SingularityBeamFx)
  })
})
