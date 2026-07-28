import { describe, it, expect } from 'vitest'
import type * as THREE from 'three'
import { createNameplate } from '../../src/game/fx/nameplate'
import { NAMEPLATE_HEIGHT } from '../../src/constants'

describe('nameplate', () => {
  it('sprite: noRaycast, positioned above the head, material present', () => {
    const s = createNameplate('Sanya', '#37f')
    expect(s.userData.noRaycast).toBe(true)
    expect(s.position.y).toBe(NAMEPLATE_HEIGHT)
    expect((s.material as THREE.SpriteMaterial).depthWrite).toBe(false)
  })
})
