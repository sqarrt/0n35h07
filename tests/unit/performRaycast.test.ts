import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { performRaycast } from '../../src/utils/raycast'

function makeScene(...meshes: THREE.Mesh[]): THREE.Scene {
  const scene = new THREE.Scene()
  meshes.forEach(m => scene.add(m))
  return scene
}

function boxAt(x: number, y: number, z: number, name = ''): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
  mesh.position.set(x, y, z)
  mesh.name = name
  mesh.updateMatrixWorld(true)
  return mesh
}

describe('performRaycast', () => {
  it('finds an intersection with a valid mesh', () => {
    const target = boxAt(0, 0, -5, 'target')
    const scene = makeScene(target)
    const origin = new THREE.Vector3(0, 0, 0)
    const dir = new THREE.Vector3(0, 0, -1)
    const hits = performRaycast(scene, origin, dir)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].object).toBe(target)
  })

  it('filters out objects with userData.noRaycast', () => {
    const target = boxAt(0, 0, -5, 'target')
    target.userData.noRaycast = true
    const scene = makeScene(target)
    const origin = new THREE.Vector3(0, 0, 0)
    const dir = new THREE.Vector3(0, 0, -1)
    const hits = performRaycast(scene, origin, dir)
    expect(hits.length).toBe(0)
  })

  it('filters by excludeNames', () => {
    const target = boxAt(0, 0, -5, 'wall')
    const scene = makeScene(target)
    const origin = new THREE.Vector3(0, 0, 0)
    const dir = new THREE.Vector3(0, 0, -1)
    const hits = performRaycast(scene, origin, dir, { excludeNames: ['wall'] })
    expect(hits.length).toBe(0)
  })

  it('filters by excludeEntityIds (exclusion by entityId)', () => {
    const own = boxAt(0, 0, -5)
    own.userData.entityId = 1
    const scene = makeScene(own)
    const origin = new THREE.Vector3(0, 0, 0)
    const dir = new THREE.Vector3(0, 0, -1)
    expect(performRaycast(scene, origin, dir, { excludeEntityIds: [1] }).length).toBe(0)
    expect(performRaycast(scene, origin, dir, { excludeEntityIds: [2] }).length).toBeGreaterThan(0)
  })
})
