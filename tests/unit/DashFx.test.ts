import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { WaveTrail } from '../../src/game/fx/dash/WaveTrail'
import { RiftTrail } from '../../src/game/fx/dash/RiftTrail'
import { createDashFx } from '../../src/game/fx/dash/createDashFx'
import { AfterimageTrail } from '../../src/game/fx/AfterimageTrail'
import type { IDashTrail } from '../../src/game/abstractions'

const COLOR = '#4fa'
const STEP = 1 / 60

/** Прогоняет рывок: позиция едет по +X, dashing=true, durMs миллисекунд. */
function runDash(trail: IDashTrail, durMs: number) {
  const pos = new THREE.Vector3(0, 1.7, 0)
  for (let t = 0; t < durMs / 1000; t += STEP) {
    pos.x += 24 * STEP
    trail.update(STEP, { position: pos, dashing: true })
  }
}

/** Дожигает время без рывка (элементы должны угаснуть). */
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
    it('во время рывка появляются видимые элементы, без рывка — гаснут', () => {
      const trail = make()
      runDash(trail, 150)
      expect(trail.aliveCount).toBeGreaterThan(0)
      expect(visibleMeshes(trail.object3d).length).toBeGreaterThan(0)
      runIdle(trail, 800)
      expect(trail.aliveCount).toBe(0)
      expect(visibleMeshes(trail.object3d)).toHaveLength(0)
    })

    it('эмит троттлится: за один кадр — не более одного элемента/группы', () => {
      const trail = make()
      const pos = new THREE.Vector3(0, 1.7, 0)
      trail.update(STEP, { position: pos, dashing: true })
      const after1 = trail.aliveCount
      expect(after1).toBeGreaterThan(0)
      pos.x += 24 * STEP
      trail.update(STEP, { position: pos, dashing: true })   // 16мс < интервала эмита
      expect(trail.aliveCount).toBe(after1)
    })

    it('меши помечены noRaycast; dispose не бросает', () => {
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
  it('создаёт реализацию по стилю', () => {
    expect(createDashFx('streak', COLOR)).toBeInstanceOf(AfterimageTrail)
    expect(createDashFx('wave', COLOR)).toBeInstanceOf(WaveTrail)
    expect(createDashFx('rift', COLOR)).toBeInstanceOf(RiftTrail)
  })
})
