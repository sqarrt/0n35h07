import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { World } from '../../src/game/World'
import { SPAWN_HALF, EYE_HEIGHT } from '../../src/constants'

describe('World', () => {
  it('randomSpawn() — в пределах арены и на уровне глаз', () => {
    const world = new World(new THREE.Scene())
    for (let i = 0; i < 50; i++) {
      const p = world.randomSpawn()
      expect(Math.abs(p.x)).toBeLessThanOrEqual(SPAWN_HALF)
      expect(Math.abs(p.z)).toBeLessThanOrEqual(SPAWN_HALF)
      expect(p.y).toBe(EYE_HEIGHT)
    }
  })

  it('raycast() — возвращает ближайший хитбокс и исключает свой entityId', () => {
    const scene = new THREE.Scene()
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1))
    box.position.set(0, EYE_HEIGHT, -5)
    box.userData.entityId = 3
    box.updateMatrixWorld(true)
    scene.add(box)
    const world = new World(scene)
    const origin = new THREE.Vector3(0, EYE_HEIGHT, 0)
    const dir = new THREE.Vector3(0, 0, -1)
    expect(world.raycast(origin, dir, [])?.object).toBe(box)
    expect(world.raycast(origin, dir, [3])).toBeNull()
  })
})
