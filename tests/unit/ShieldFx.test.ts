import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { DomeShieldFx } from '../../src/game/fx/shield/DomeShieldFx'
import { GyroShieldFx } from '../../src/game/fx/shield/GyroShieldFx'
import { CrystalShieldFx } from '../../src/game/fx/shield/CrystalShieldFx'
import { createShieldFx } from '../../src/game/fx/shield/createShieldFx'

const STEP = 1 / 60

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh) })
  return out
}

describe('DomeShieldFx', () => {
  it('активный пульс держит прозрачности в исторических диапазонах купола', () => {
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

  it('неактивный update не трогает материалы', () => {
    const fx = new DomeShieldFx()
    const fillMat = (fx.object3d.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
    const before = fillMat.opacity
    fx.update(STEP, false)
    expect(fillMat.opacity).toBe(before)
  })
})

describe('GyroShieldFx', () => {
  it('кольца кувыркаются при active и стоят без active', () => {
    const fx = new GyroShieldFx()
    const ring = meshes(fx.object3d)[0]
    const worldBefore = ring.getWorldQuaternion(new THREE.Quaternion())
    fx.update(STEP, true)
    fx.object3d.updateMatrixWorld(true)
    const worldAfter = ring.getWorldQuaternion(new THREE.Quaternion())
    expect(worldAfter.angleTo(worldBefore)).toBeGreaterThan(0.001)
    fx.update(STEP, false)
    fx.object3d.updateMatrixWorld(true)
    const worldIdle = ring.getWorldQuaternion(new THREE.Quaternion())
    expect(worldIdle.angleTo(worldAfter)).toBeLessThan(1e-6)
  })
})

describe('CrystalShieldFx', () => {
  it('видна ровно одна грань-вспышка, и она меняется со временем', () => {
    const fx = new CrystalShieldFx()
    fx.update(STEP, true)
    const litBefore = meshes(fx.object3d).filter(m => m.visible && m.geometry.getAttribute('position').count === 3)
    expect(litBefore).toHaveLength(1)
    for (let t = 0; t < 0.3; t += STEP) fx.update(STEP, true)   // > периода смены грани
    const litAfter = meshes(fx.object3d).filter(m => m.visible && m.geometry.getAttribute('position').count === 3)
    expect(litAfter).toHaveLength(1)
    expect(litAfter[0]).not.toBe(litBefore[0])
  })
})

describe('общие требования и фабрика', () => {
  it('меши noRaycast; dispose не бросает', () => {
    for (const fx of [new DomeShieldFx(), new GyroShieldFx(), new CrystalShieldFx()]) {
      meshes(fx.object3d).forEach(m => expect(m.userData.noRaycast).toBe(true))
      expect(() => fx.dispose()).not.toThrow()
    }
  })

  it('createShieldFx выбирает реализацию по стилю', () => {
    expect(createShieldFx('dome')).toBeInstanceOf(DomeShieldFx)
    expect(createShieldFx('gyro')).toBeInstanceOf(GyroShieldFx)
    expect(createShieldFx('crystal')).toBeInstanceOf(CrystalShieldFx)
  })
})
