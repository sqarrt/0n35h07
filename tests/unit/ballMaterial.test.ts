import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createBallMaterial, createBallRing } from '../../src/game/fx/ballMaterial'

// Шейдер компилит R3F при рендере (GL в jsdom нет) — проверяем конструкцию материала и tick, без рендера.
describe('createBallMaterial', () => {
  it('smooth/planet — ровная сфера без деформации; tick безопасен', () => {
    for (const m of ['smooth', 'planet'] as const) {
      const { material, tick } = createBallMaterial('#4af', m)
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
      expect(material.transparent).toBe(true)
      expect(material.customProgramCacheKey()).not.toBe('ball-waves')   // деформации нет
      expect(() => tick(0.1)).not.toThrow()
    }
  })

  it('waves — своя программа (cache key) и onBeforeCompile; tick двигает время', () => {
    const { material, tick } = createBallMaterial('#4af', 'waves')
    expect(material.customProgramCacheKey()).toBe('ball-waves')
    expect(typeof material.onBeforeCompile).toBe('function')
    expect(() => { tick(0.1); tick(0.2) }).not.toThrow()
  })
})

describe('createBallRing', () => {
  it('строит меш кольца (noRaycast); tick/setOpacity/dispose не бросают', () => {
    const ring = createBallRing('#4af')
    expect(ring.mesh).toBeInstanceOf(THREE.Mesh)
    expect(ring.mesh.userData.noRaycast).toBe(true)
    expect(() => { ring.tick(0.1); ring.setOpacity(0.4) }).not.toThrow()
    expect(() => ring.dispose()).not.toThrow()
  })
})
