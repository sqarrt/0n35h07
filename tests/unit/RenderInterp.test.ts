import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Body } from '../../src/game/Body'

function bodyAt(x: number): Body {
  const b = new Body(1, '#f44')
  b.position.set(x, 1.7, 0)
  return b
}

describe('Body render interpolation', () => {
  it('captureTick snapshots prev→cur; renderPos lerps between them', () => {
    const b = bodyAt(0)
    b.captureTick()                 // cur = (0,1.7,0), prev = (0,1.7,0)
    b.position.set(2, 1.7, 0)
    b.captureTick()                 // prev = (0,..), cur = (2,..)
    const out = new THREE.Vector3()
    expect(b.renderPos(0, out).x).toBeCloseTo(0, 5)
    expect(b.renderPos(0.5, out).x).toBeCloseTo(1, 5)
    expect(b.renderPos(1, out).x).toBeCloseTo(2, 5)
  })
  it('with no movement, renderPos is constant for any alpha (no jitter)', () => {
    const b = bodyAt(5)
    b.captureTick(); b.captureTick()
    const out = new THREE.Vector3()
    expect(b.renderPos(0.3, out).x).toBeCloseTo(5, 5)
    expect(b.renderPos(0.9, out).x).toBeCloseTo(5, 5)
  })
  it('resetTickPos collapses both snapshots to the live position (no sweep across a teleport)', () => {
    const b = bodyAt(0)
    b.captureTick()
    b.position.set(9, 1.7, 0)
    b.resetTickPos()                // teleport — both snapshots jump to 9
    const out = new THREE.Vector3()
    expect(b.renderPos(0, out).x).toBeCloseTo(9, 5)
    expect(b.renderPos(1, out).x).toBeCloseTo(9, 5)
  })
})
