import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { DeathBurst } from '../../src/game/fx/DeathBurst'
import { DEATH_BURST_LIFE } from '../../src/constants'

const DT = 0.016

// Particle burst — pure visual logic (THREE without WebGL), tested in jsdom.
describe('DeathBurst', () => {
  it('emit scatters particles; they fade to zero over time', () => {
    const b = new DeathBurst(new THREE.Color('#4af'))
    expect(b.aliveCount).toBe(0)
    b.emit(new THREE.Vector3(0, 1.7, 0))
    expect(b.aliveCount).toBeGreaterThan(0)
    const frames = Math.ceil(DEATH_BURST_LIFE / 1000 / DT) + 2
    for (let i = 0; i < frames; i++) b.update(DT)
    expect(b.aliveCount).toBe(0)
  })

  it('particles move and fall under gravity', () => {
    // Determinize the scatter: rnd=0.25 → horizontal speed ≠0 and moderate vy (gravity has time to pull back).
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const b = new DeathBurst(new THREE.Color('#4af'))
    b.emit(new THREE.Vector3(0, 5, 0))
    spy.mockRestore()
    for (let i = 0; i < 14; i++) b.update(DT)
    const meshes = b.object3d.children as THREE.Mesh[]
    const moved = meshes.some(m => Math.abs(m.position.x) > 0.01 || Math.abs(m.position.z) > 0.01)
    expect(moved).toBe(true)                                   // scattered horizontally
    const minY = Math.min(...meshes.filter(m => m.visible).map(m => m.position.y))
    expect(minY).toBeLessThan(5)                               // already falling (gravity)
  })
})
