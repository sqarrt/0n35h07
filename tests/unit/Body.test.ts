import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Body } from '../../src/game/Body'
import { JUMP_FORCE, DASH_DURATION, MOVE_SPEED, MAX_SPEED } from '../../src/constants'
import { makeEmptyArt, BALL_ART_SIZE } from '../../src/game/ballArt'

// Body больше не интегрирует позицию (это делает Rapier KCC) — он копит НАМЕРЕНИЕ через скоростную модель.
describe('Body', () => {
  it('move()+stepHorizontal: разгон желаемой горизонтали в desired (Y не трогает)', () => {
    const b = new Body(0, '#4af')
    b.move(new THREE.Vector3(MOVE_SPEED, 99, 0), 1)   // желаем +X (Y у горизонтали игнорируется)
    b.stepHorizontal(0.016, null)                     // на земле — разгон к wishspeed
    const d = b.consumeDesired()
    expect(d.x).toBeGreaterThan(0)   // velH разогналась в +X → desired.x > 0
    expect(d.z).toBe(0)
    expect(d.y).toBe(0)              // горизонталь Y не трогает (Y — гравитация в stepVertical)
    expect(b.consumeDesired().x).toBe(0)   // consumeDesired обнуляет
  })

  it('прыжок (held): на земле взлёт; удержание в воздухе не прыгает; новое нажатие → двойной прыжок', () => {
    const b = new Body(0, '#4af')
    expect(b.grounded).toBe(true)
    b.setJumpInput(true)
    b.stepJump()
    expect(b.velocityY).toBe(JUMP_FORCE)   // прыжок с земли (+ восстановил воздушный прыжок)
    b.setGrounded(false)
    b.velocityY = 0
    b.stepJump()                           // jumpHeld всё ещё true (НЕ ребро) → в воздухе не прыгает
    expect(b.velocityY).toBe(0)
    b.setJumpInput(false); b.stepJump()    // отпустили
    b.setJumpInput(true);  b.stepJump()    // НОВОЕ нажатие в воздухе → двойной прыжок
    expect(b.velocityY).toBe(JUMP_FORCE)
    b.velocityY = 0
    b.setJumpInput(false); b.stepJump()
    b.setJumpInput(true);  b.stepJump()    // воздушные прыжки исчерпаны (MAX_AIR_JUMPS=1) → нет
    expect(b.velocityY).toBe(0)
  })

  it('верхний предел скорости: горизонталь не превышает MAX_SPEED', () => {
    const b = new Body(0, '#4af')
    b.move(new THREE.Vector3(1000, 0, 0), 1)   // желаем нереально много → упрёмся в потолок
    let d = new THREE.Vector3()
    for (let i = 0; i < 20; i++) { b.stepHorizontal(0.016, null); d = b.consumeDesired() }
    const speed = Math.hypot(d.x, d.z) / 0.016   // desired = velH·dt → восстанавливаем скорость
    expect(speed).toBeLessThanOrEqual(MAX_SPEED + 1e-3)
    expect(speed).toBeGreaterThan(MOVE_SPEED)    // и при этом разогнались выше обычной
  })

  it('bhop: инерция переживает приземление (setGrounded не гасит горизонталь)', () => {
    const b = new Body(0, '#4af')
    b.move(new THREE.Vector3(MOVE_SPEED, 0, 0), 1)
    for (let i = 0; i < 40; i++) b.stepHorizontal(0.016, null)   // разогнались на земле
    b.consumeDesired()
    b.setGrounded(false)   // взлетели
    b.setGrounded(true)    // приземлились — velH НЕ обнуляется
    b.move(new THREE.Vector3(MOVE_SPEED, 0, 0), 1)
    b.setJumpInput(true); b.stepJump()                     // bhop-кадр: трение пропускается
    b.stepHorizontal(0.016, null)
    expect(b.consumeDesired().x).toBeGreaterThan(0)        // скорость сохранена
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

  it('setHittable переключает хитбокс как raycast-цель', () => {
    const b = new Body(0, '#4af')
    const hitbox = b.object3d.children[1] as THREE.Mesh
    expect(hitbox.userData.noRaycast).toBeFalsy()   // изначально цель
    b.setHittable(false)
    expect(hitbox.userData.noRaycast).toBe(true)     // мёртвый — не цель
    b.setHittable(true)
    expect(hitbox.userData.noRaycast).toBe(false)
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

  it('reconcileTowardNet тянет позицию к авторитету на долю NET_RECONCILE_LERP', () => {
    const b = new Body(0, '#4af')
    b.applyNetTarget(new THREE.Vector3(10, 0, 0))
    const next = { x: 0, y: 0, z: 0 }
    b.reconcileTowardNet(next)
    expect(next.x).toBeGreaterThan(0)     // сдвинулись к цели
    expect(next.x).toBeLessThan(10)       // но не до конца (мягко)
  })

  it('reconcileTowardNet без авторитета — no-op', () => {
    const b = new Body(0, '#4af')
    const next = { x: 1, y: 2, z: 3 }
    b.reconcileTowardNet(next)
    expect(next).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('dashProgress: 1 в покое, <1 на кулдауне', () => {
    const b = new Body(0, '#4af')
    expect(b.dashProgress()).toBe(1)
    b.dash(new THREE.Vector3(0, 0, -1))
    expect(b.dashProgress()).toBeLessThan(1)
  })

  it('принимает рисунок, setArt не падает, dispose чистит текстуру', () => {
    const art = makeEmptyArt()
    art.front[8 * BALL_ART_SIZE + 8] = 1
    const b = new Body(1, '#4af', 'smooth', '#4af', art)
    expect(() => b.setArt(art)).not.toThrow()
    expect(() => b.setArt(null)).not.toThrow()
    expect(() => b.dispose()).not.toThrow()
  })
})
