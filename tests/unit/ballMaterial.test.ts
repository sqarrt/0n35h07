import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createBallMaterial, createBallRing } from '../../src/game/fx/ballMaterial'
import { makeEmptyArt, BALL_ART_SIZE, ART_TEX_W } from '../../src/game/ballArt'

// Шейдер компилит R3F при рендере (GL в jsdom нет) — проверяем конструкцию материала и tick, без рендера.
describe('createBallMaterial', () => {
  it('smooth/planet — ровная сфера; cache key по модели; tick безопасен', () => {
    for (const m of ['smooth', 'planet'] as const) {
      const { material, tick } = createBallMaterial('#4af', m)
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
      expect(material.transparent).toBe(true)
      expect(material.customProgramCacheKey()).toBe(`ball-${m}-art`)
      expect(() => tick(0.1)).not.toThrow()
    }
  })

  it('waves — своя программа (cache key) и onBeforeCompile; tick двигает время', () => {
    const { material, tick } = createBallMaterial('#4af', 'waves')
    expect(material.customProgramCacheKey()).toBe('ball-waves-art')
    expect(typeof material.onBeforeCompile).toBe('function')
    expect(() => { tick(0.1); tick(0.2) }).not.toThrow()
  })

  it('setArt обновляет данные текстуры без пересоздания материала', () => {
    const ball = createBallMaterial('#4af', 'smooth')
    const before = ball.material
    const art = makeEmptyArt()
    art.front[8 * BALL_ART_SIZE + 8] = 1
    ball.setArt(art)
    expect(ball.material).toBe(before)               // материал не пересоздан
    // клетка (8,8) перёд → texel (8, SIZE-1-8) = 0 (закрашено) в данных текстуры
    const data = ball.artTexture.image.data as Uint8Array
    expect(data[((BALL_ART_SIZE - 1 - 8) * ART_TEX_W + 8) * 4]).toBe(0)
    expect(() => ball.dispose()).not.toThrow()
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
