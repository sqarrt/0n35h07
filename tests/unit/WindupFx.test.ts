import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { ClassicWindupFx } from '../../src/game/fx/windup/ClassicWindupFx'
import type { WindupFrame } from '../../src/game/fx/windup/types'
import { WINDUP_SCALE_GAIN, BOT_COLOR_WHITE } from '../../src/constants'

export function makeTarget(color = '#4af') {
  const material = new THREE.MeshStandardMaterial({ color })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), material)
  return { mesh, material }
}

export const makeFrame = (over: Partial<WindupFrame> = {}): WindupFrame => ({
  progress: 0, shrink: 1, baseColor: new THREE.Color('#4af'),
  aimDir: new THREE.Vector3(0, 0, -1), origin: new THREE.Vector3(), visible: true, ...over,
})

describe('ClassicWindupFx', () => {
  it('нейтральный кадр: scale=1, цвет=база, emissive чёрный', () => {
    const fx = new ClassicWindupFx()
    const t = makeTarget()
    t.mesh.scale.setScalar(1.4)                      // «грязное» состояние от прошлого заряда
    t.material.emissive.setRGB(1, 0, 0)
    fx.apply(0.016, t, makeFrame())
    expect(t.mesh.scale.x).toBe(1)
    expect(t.material.color.getHexString()).toBe(new THREE.Color('#4af').getHexString())
    expect(t.material.emissive.getHex()).toBe(0)
  })

  it('заряд: раздув по прогрессу, цвет уходит к белому', () => {
    const fx = new ClassicWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame({ progress: 1 }))
    expect(t.mesh.scale.x).toBeCloseTo(1 + WINDUP_SCALE_GAIN)
    expect(t.material.color.getHexString()).toBe(new THREE.Color(BOT_COLOR_WHITE).getHexString())
  })

  it('сдувание: масштаб спадает с shrink, цвет уже базовый', () => {
    const fx = new ClassicWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame({ progress: 0, shrink: 0.5 }))
    expect(t.mesh.scale.x).toBeCloseTo(1 + WINDUP_SCALE_GAIN * 0.5)
    expect(t.material.color.getHexString()).toBe(new THREE.Color('#4af').getHexString())
  })

  it('world-space части нет (пустая группа), dispose не бросает', () => {
    const fx = new ClassicWindupFx()
    expect(fx.object3d.children.length).toBe(0)
    expect(() => fx.dispose()).not.toThrow()
  })
})
