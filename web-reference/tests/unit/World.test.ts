import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { World } from '../../src/game/World'
import { EYE_HEIGHT } from '../../src/constants'

describe('World', () => {
  it('raycast() — returns the nearest hitbox and excludes its own entityId', () => {
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
