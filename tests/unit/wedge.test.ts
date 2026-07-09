import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { wedgeQuaternion, wedgeRotationY } from '../../src/game/wedge'

describe('wedge orientation', () => {
  it('side=false — чистый yaw по dir (прежнее поведение)', () => {
    for (const d of [0, 1, 2, 3]) {
      const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wedgeRotationY(d))
      expect(wedgeQuaternion(d, false).angleTo(expected)).toBeCloseTo(0)
    }
  })

  it('side=true — ось выдавливания (X) встаёт вертикально (диагональная стена)', () => {
    const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(wedgeQuaternion(0, true))
    expect(Math.abs(axis.y)).toBeCloseTo(1)
    expect(Math.abs(axis.x)).toBeCloseTo(0)
    expect(Math.abs(axis.z)).toBeCloseTo(0)
  })
})
