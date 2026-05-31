import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Body } from '../../src/game/Body'
import { JUMP_FORCE, DASH_DURATION } from '../../src/constants'

// Body больше не интегрирует позицию (это делает Rapier KCC) — он копит НАМЕРЕНИЕ.
describe('Body', () => {
  it('move() копит горизонтальное намерение (Y не трогает)', () => {
    const b = new Body(0, '#4af')
    b.move(new THREE.Vector3(3, 99, -2), 1)
    const d = b.consumeDesired()
    expect(d.x).toBeCloseTo(3)
    expect(d.z).toBeCloseTo(-2)
    expect(d.y).toBe(0)
    expect(b.consumeDesired().x).toBe(0)   // consumeDesired обнуляет
  })

  it('jump() задаёт скорость только на земле', () => {
    const b = new Body(0, '#4af')
    expect(b.grounded).toBe(true)
    b.jump()
    expect(b.velocityY).toBe(JUMP_FORCE)
    b.setGrounded(false)
    b.velocityY = 0
    b.jump()                               // в воздухе — игнор
    expect(b.velocityY).toBe(0)
  })

  it('stepVertical() копит падение в desired.y', () => {
    const b = new Body(0, '#4af')
    b.setGrounded(false)
    b.stepVertical(0.1)
    expect(b.velocityY).toBeLessThan(0)    // гравитация тянет вниз
    expect(b.consumeDesired().y).toBeLessThan(0)
  })

  it('setGrounded(true) обнуляет вертикальную скорость', () => {
    const b = new Body(0, '#4af')
    b.setGrounded(false)
    b.velocityY = -5
    b.setGrounded(true)
    expect(b.velocityY).toBe(0)
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

  it('dash() стартует только если кулдаун готов и dir≠0', () => {
    const b = new Body(0, '#4af')
    expect(b.dash(new THREE.Vector3(0, 0, 0))).toBe(false)   // нет направления
    expect(b.dash(new THREE.Vector3(0, 0, -1))).toBe(true)   // ок
    expect(b.dash(new THREE.Vector3(1, 0, 0))).toBe(false)   // кулдаун
  })

  it('stepDash() копит рывок в desired, dashing отражает окно', () => {
    const b = new Body(0, '#4af')
    b.dash(new THREE.Vector3(0, 0, -1))
    expect(b.dashing).toBe(true)
    b.stepDash(0.016)
    expect(b.consumeDesired().z).toBeLessThan(0)
  })

  it('dashing=false после окончания окна', () => {
    const b = new Body(0, '#4af')
    b.dash(new THREE.Vector3(0, 0, -1))
    const steps = Math.ceil(DASH_DURATION / 1000 / 0.016) + 2
    for (let i = 0; i < steps; i++) b.stepDash(0.016)
    expect(b.dashing).toBe(false)
  })
})
