import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createBallMaterial, createBallRing } from '../../src/game/fx/ballMaterial'
import { makeEmptyArt, BALL_ART_SIZE } from '../../src/game/ballArt'
import { ART_TEX_W } from '../../src/game/fx/artTexture'

// R3F compiles the shader at render time (no GL in jsdom) — we check material construction and tick, without rendering.
describe('createBallMaterial', () => {
  it('smooth/planet — even sphere; cache key per model; tick is safe', () => {
    for (const m of ['smooth', 'planet'] as const) {
      const { material, tick } = createBallMaterial('#4af', m)
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
      expect(material.transparent).toBe(true)
      expect(material.customProgramCacheKey()).toBe(`ball-${m}-art`)
      expect(() => tick(0.1)).not.toThrow()
    }
  })

  it('waves — own program (cache key) and onBeforeCompile; tick advances time', () => {
    const { material, tick } = createBallMaterial('#4af', 'waves')
    expect(material.customProgramCacheKey()).toBe('ball-waves-art')
    expect(typeof material.onBeforeCompile).toBe('function')
    expect(() => { tick(0.1); tick(0.2) }).not.toThrow()
  })

  it('setArt updates texture data without recreating the material', () => {
    const ball = createBallMaterial('#4af', 'smooth')
    const before = ball.material
    const art = makeEmptyArt()
    art.front[8 * BALL_ART_SIZE + 8] = 1
    ball.setArt(art)
    expect(ball.material).toBe(before)               // material not recreated
    // cell (8,8) front → texel (8, SIZE-1-8) = 0 (painted) in texture data
    const data = ball.artTexture.image.data as Uint8Array
    expect(data[((BALL_ART_SIZE - 1 - 8) * ART_TEX_W + 8) * 4]).toBe(0)
    expect(() => ball.dispose()).not.toThrow()
  })
})

describe('createBallRing', () => {
  it('builds the ring mesh (noRaycast); tick/setOpacity/dispose do not throw', () => {
    const ring = createBallRing('#4af')
    expect(ring.mesh).toBeInstanceOf(THREE.Mesh)
    expect(ring.mesh.userData.noRaycast).toBe(true)
    expect(() => { ring.tick(0.1); ring.setOpacity(0.4) }).not.toThrow()
    expect(() => ring.dispose()).not.toThrow()
  })
})
