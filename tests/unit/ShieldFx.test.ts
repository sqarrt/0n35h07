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

describe('HexShieldFx', () => {
  const opacity = (m: THREE.Mesh) => (m.material as THREE.MeshBasicMaterial).opacity

  it('волна активации: сразу после включения верхние плитки ярче нижних', () => {
    const fx = new HexShieldFx()
    fx.update(0.03, true)   // ~30мс: волна у макушки, низ ещё дежурный
    const tiles = meshes(fx.object3d)
    const top = tiles[0]                     // фибоначчи-сфера: плитка 0 у макушки
    const bottom = tiles[tiles.length - 1]   // последняя — у дна
    expect(opacity(top)).toBeGreaterThan(opacity(bottom) + 0.2)
  })

  it('после прохода волны все плитки в дежурном диапазоне; повторная активация — волна заново', () => {
    const fx = new HexShieldFx()
    for (let t = 0; t < 0.8; t += STEP) fx.update(STEP, true)   // > WAVE+FLASH — волна отгорела
    const tiles = meshes(fx.object3d)
    tiles.forEach(m => expect(opacity(m)).toBeLessThan(0.3))    // дежурное мерцание, без вспышек
    fx.update(STEP, false)   // деактивация
    fx.update(0.03, true)    // фронт активации → волна снова у макушки
    expect(opacity(tiles[0])).toBeGreaterThan(opacity(tiles[tiles.length - 1]) + 0.2)
  })

  it('без active плитки не анимируются', () => {
    const fx = new HexShieldFx()
    const before = opacity(meshes(fx.object3d)[0])
    fx.update(STEP, false)
    expect(opacity(meshes(fx.object3d)[0])).toBe(before)
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
    for (const fx of [new DomeShieldFx(), new HexShieldFx(), new CrystalShieldFx()]) {
      meshes(fx.object3d).forEach(m => expect(m.userData.noRaycast).toBe(true))
      expect(() => fx.dispose()).not.toThrow()
    }
  })

  it('createShieldFx выбирает реализацию по стилю', () => {
    expect(createShieldFx('dome')).toBeInstanceOf(DomeShieldFx)
    expect(createShieldFx('hex')).toBeInstanceOf(HexShieldFx)
    expect(createShieldFx('crystal')).toBeInstanceOf(CrystalShieldFx)
  })
})
