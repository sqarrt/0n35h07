import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { DeathBurst } from '../../src/game/fx/DeathBurst'
import { DEATH_BURST_LIFE } from '../../src/constants'

const DT = 0.016

// Хлопок частиц — чистая визуальная логика (THREE без WebGL), тестируем в jsdom.
describe('DeathBurst', () => {
  it('emit разбрасывает частицы; со временем гаснут до нуля', () => {
    const b = new DeathBurst(new THREE.Color('#4af'))
    expect(b.aliveCount).toBe(0)
    b.emit(new THREE.Vector3(0, 1.7, 0))
    expect(b.aliveCount).toBeGreaterThan(0)
    const frames = Math.ceil(DEATH_BURST_LIFE / 1000 / DT) + 2
    for (let i = 0; i < frames; i++) b.update(DT)
    expect(b.aliveCount).toBe(0)
  })

  it('частицы движутся и падают под гравитацией', () => {
    const b = new DeathBurst(new THREE.Color('#4af'))
    b.emit(new THREE.Vector3(0, 5, 0))
    for (let i = 0; i < 6; i++) b.update(DT)
    const meshes = b.object3d.children as THREE.Mesh[]
    const moved = meshes.some(m => Math.abs(m.position.x) > 0.01 || Math.abs(m.position.z) > 0.01)
    expect(moved).toBe(true)                                   // разлетелись по горизонтали
    const minY = Math.min(...meshes.filter(m => m.visible).map(m => m.position.y))
    expect(minY).toBeLessThan(5)                               // часть уже падает (гравитация)
  })
})
