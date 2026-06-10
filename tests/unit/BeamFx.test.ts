import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { ClassicBeamFx } from '../../src/game/fx/beam/ClassicBeamFx'
import type { IBeamFx } from '../../src/game/fx/beam/types'
import { BEAM_DURATION } from '../../src/constants'

const start = new THREE.Vector3(0, 1, 0)
const end = new THREE.Vector3(0, 1, -10)

/** Есть ли в поддереве видимый меш с видимой цепочкой родителей (до root). */
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

/** Прогнать update маленькими шагами на totalMs вперёд. */
export function advanceFx(fx: IBeamFx, totalMs: number, stepMs = 16) {
  for (let t = 0; t < totalMs; t += stepMs) fx.update(stepMs / 1000)
}

describe('ClassicBeamFx', () => {
  it('до play ничего не видно', () => {
    const fx = new ClassicBeamFx()
    fx.update(0.016)
    expect(anyVisible(fx.object3d)).toBe(false)
  })

  it('play → луч видим; после BEAM_DURATION + афтерглоу — погас', () => {
    const fx = new ClassicBeamFx('white', '#4af')
    fx.play(start, end)
    fx.update(0.016)
    expect(anyVisible(fx.object3d)).toBe(true)
    advanceFx(fx, BEAM_DURATION + 1000)   // запас на затухание афтерглоу
    expect(anyVisible(fx.object3d)).toBe(false)
  })

  it('reset гасит мгновенно', () => {
    const fx = new ClassicBeamFx()
    fx.play(start, end)
    fx.update(0.016)
    fx.reset()
    expect(anyVisible(fx.object3d)).toBe(false)
  })

  it('все меши noRaycast, dispose не бросает', () => {
    const fx = new ClassicBeamFx()
    let meshes = 0
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh) { meshes++; expect(o.userData.noRaycast).toBe(true) } })
    expect(meshes).toBeGreaterThan(0)
    expect(() => fx.dispose()).not.toThrow()
  })
})
