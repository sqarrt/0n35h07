import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Body } from '../../src/game/Body'
import { EYE_HEIGHT } from '../../src/constants'

describe('Body', () => {
  it('на земле без прыжка не падает', () => {
    const b = new Body(0, '#4af')
    b.setPosition(new THREE.Vector3(0, EYE_HEIGHT, 0))
    b.update(0.1)
    expect(b.position.y).toBe(EYE_HEIGHT)
  })

  it('jump() поднимает, затем гравитация возвращает на землю', () => {
    const b = new Body(0, '#4af')
    b.setPosition(new THREE.Vector3(0, EYE_HEIGHT, 0))
    b.jump()
    b.update(0.05)
    expect(b.position.y).toBeGreaterThan(EYE_HEIGHT)        // взлетел
    for (let i = 0; i < 60; i++) b.update(0.05)             // ~3с — приземлился
    expect(b.position.y).toBe(EYE_HEIGHT)
  })

  it('move() двигает только по X/Z, Y не трогает', () => {
    const b = new Body(0, '#4af')
    b.setPosition(new THREE.Vector3(0, EYE_HEIGHT, 0))
    b.move(new THREE.Vector3(3, 99, -2), 1)
    expect(b.position.x).toBeCloseTo(3)
    expect(b.position.z).toBeCloseTo(-2)
    expect(b.position.y).toBe(EYE_HEIGHT)
  })

  it('setVisible() переключает видимость меша тела', () => {
    const b = new Body(0, '#4af')
    b.setVisible(false)
    expect(b.mesh.visible).toBe(false)
    b.setVisible(true)
    expect(b.mesh.visible).toBe(true)
  })

  it('хитбокс несёт entityId и помечается невидимым', () => {
    const b = new Body(7, '#4af')
    const hitbox = b.object3d.children[1] as THREE.Mesh
    expect(hitbox.userData.entityId).toBe(7)
    expect(hitbox.visible).toBe(false)
  })
})
