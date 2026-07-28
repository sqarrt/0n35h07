import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { DomeShieldFx } from '../../src/game/fx/shield/DomeShieldFx'
import { HexShieldFx } from '../../src/game/fx/shield/HexShieldFx'
import { CrystalShieldFx } from '../../src/game/fx/shield/CrystalShieldFx'
import { createShieldFx } from '../../src/game/fx/shield/createShieldFx'

const STEP = 1 / 60

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh) })
  return out
}

describe('DomeShieldFx', () => {
  it('active pulse keeps opacities within the dome historical ranges', () => {
    const fx = new DomeShieldFx()
    const [fill, wire] = fx.object3d.children as THREE.Mesh[]
    const fillMat = fill.material as THREE.MeshBasicMaterial
    const wireMat = wire.material as THREE.MeshBasicMaterial
    for (let i = 0; i < 5; i++) {
      fx.update(STEP, true)
      expect(fillMat.opacity).toBeGreaterThanOrEqual(0.08)
      expect(fillMat.opacity).toBeLessThanOrEqual(0.18)
      expect(wireMat.opacity).toBeGreaterThanOrEqual(0.3)
      expect(wireMat.opacity).toBeLessThanOrEqual(0.6)
    }
  })

  it('inactive update does not touch materials', () => {
    const fx = new DomeShieldFx()
    const fillMat = (fx.object3d.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
    const before = fillMat.opacity
    fx.update(STEP, false)
    expect(fillMat.opacity).toBe(before)
  })
})

describe('HexShieldFx', () => {
  const opacity = (m: THREE.Mesh) => (m.material as THREE.MeshBasicMaterial).opacity

  it('activation wave: right after turning on, top tiles are brighter than bottom ones', () => {
    const fx = new HexShieldFx()
    fx.update(0.03, true)   // ~30ms: wave near the top, bottom still idle
    const tiles = meshes(fx.object3d)
    const top = tiles[0]                     // fibonacci sphere: tile 0 near the top
    const bottom = tiles[tiles.length - 1]   // last one — near the bottom
    expect(opacity(top)).toBeGreaterThan(opacity(bottom) + 0.2)
  })

  it('after the wave passes all tiles are in the idle range; re-activation — wave again', () => {
    const fx = new HexShieldFx()
    for (let t = 0; t < 0.8; t += STEP) fx.update(STEP, true)   // > WAVE+FLASH — wave burnt out
    const tiles = meshes(fx.object3d)
    tiles.forEach(m => expect(opacity(m)).toBeLessThan(0.3))    // idle shimmer, no flashes
    fx.update(STEP, false)   // deactivation
    fx.update(0.03, true)    // activation front → wave near the top again
    expect(opacity(tiles[0])).toBeGreaterThan(opacity(tiles[tiles.length - 1]) + 0.2)
  })

  it('without active, tiles are not animated', () => {
    const fx = new HexShieldFx()
    const before = opacity(meshes(fx.object3d)[0])
    fx.update(STEP, false)
    expect(opacity(meshes(fx.object3d)[0])).toBe(before)
  })
})

describe('CrystalShieldFx', () => {
  it('exactly one lit face is visible, and it changes over time', () => {
    const fx = new CrystalShieldFx()
    fx.update(STEP, true)
    const litBefore = meshes(fx.object3d).filter(m => m.visible && m.geometry.getAttribute('position').count === 3)
    expect(litBefore).toHaveLength(1)
    for (let t = 0; t < 0.3; t += STEP) fx.update(STEP, true)   // > the face-switch period
    const litAfter = meshes(fx.object3d).filter(m => m.visible && m.geometry.getAttribute('position').count === 3)
    expect(litAfter).toHaveLength(1)
    expect(litAfter[0]).not.toBe(litBefore[0])
  })
})

describe('common requirements and factory', () => {
  it('meshes noRaycast; dispose does not throw', () => {
    for (const fx of [new DomeShieldFx(), new HexShieldFx(), new CrystalShieldFx()]) {
      meshes(fx.object3d).forEach(m => expect(m.userData.noRaycast).toBe(true))
      expect(() => fx.dispose()).not.toThrow()
    }
  })

  it('createShieldFx selects implementation by style', () => {
    expect(createShieldFx('dome')).toBeInstanceOf(DomeShieldFx)
    expect(createShieldFx('hex')).toBeInstanceOf(HexShieldFx)
    expect(createShieldFx('crystal')).toBeInstanceOf(CrystalShieldFx)
  })
})
