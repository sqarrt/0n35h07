import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { ClassicWindupFx } from '../../src/game/fx/windup/ClassicWindupFx'
import { RageWindupFx } from '../../src/game/fx/windup/RageWindupFx'
import { SingularityWindupFx } from '../../src/game/fx/windup/SingularityWindupFx'
import { createWindupFx } from '../../src/game/fx/windup/createWindupFx'
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

describe('RageWindupFx', () => {
  it('нейтральный кадр: scale=1, цвет=база, emissive чёрный, челюсти скрыты', () => {
    const fx = new RageWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame())
    expect(t.mesh.scale.x).toBe(1)
    expect(t.material.color.getHexString()).toBe(new THREE.Color('#4af').getHexString())
    expect(t.material.emissive.getHex()).toBe(0)
    expect(fx.object3d.visible).toBe(false)
  })

  it('заряд: шар раздувается и темнеет, emissive красный, челюсти видимы и раскрываются', () => {
    const fx = new RageWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame({ progress: 0.3 }))
    // children[0] — верхняя челюсть (порядок add в конструкторе)
    const openEarly = fx.object3d.children[0].position.y
    fx.apply(0.016, t, makeFrame({ progress: 1 }))
    expect(t.mesh.scale.x).toBeGreaterThan(1)
    expect(t.material.emissive.r).toBeGreaterThan(0)        // раскалённое свечение
    expect(t.material.color.r).toBeLessThan(0.5)            // потемнел (не белеет, как classic)
    expect(fx.object3d.visible).toBe(true)
    // children[0] — верхняя челюсть (порядок add в конструкторе)
    expect(fx.object3d.children[0].position.y).toBeGreaterThan(openEarly)   // пасть раскрывается дальше
  })

  it('visible=false (FP) скрывает челюсти даже при заряде', () => {
    const fx = new RageWindupFx()
    fx.apply(0.016, makeTarget(), makeFrame({ progress: 0.5, visible: false }))
    expect(fx.object3d.visible).toBe(false)
  })

  it('челюсти позиционируются перед шаром по aimDir', () => {
    const fx = new RageWindupFx()
    fx.apply(0.016, makeTarget(), makeFrame({
      progress: 0.5,
      origin: new THREE.Vector3(10, 2, 0),
      aimDir: new THREE.Vector3(0, 0, -1),
    }))
    expect(fx.object3d.position.x).toBeCloseTo(10)
    expect(fx.object3d.position.z).toBeLessThan(0)          // вынесены вперёд по взгляду
  })

  it('все меши помечены noRaycast, dispose не бросает', () => {
    const fx = new RageWindupFx()
    let meshes = 0
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh) { meshes++; expect(o.userData.noRaycast).toBe(true) } })
    expect(meshes).toBeGreaterThan(0)
    expect(() => fx.dispose()).not.toThrow()
  })
})

describe('SingularityWindupFx', () => {
  it('нейтральный кадр: scale=1, цвет=база, вихрь скрыт', () => {
    const fx = new SingularityWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame())
    expect(t.mesh.scale.x).toBe(1)
    expect(t.material.color.getHexString()).toBe(new THREE.Color('#4af').getHexString())
    expect(fx.object3d.visible).toBe(false)
  })

  it('заряд: шар СЖИМАЕТСЯ (но не в ноль) и темнеет, вихрь видим', () => {
    const fx = new SingularityWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame({ progress: 1 }))
    expect(t.mesh.scale.x).toBeLessThan(1)
    expect(t.mesh.scale.x).toBeGreaterThan(0.3)
    expect(t.material.color.r).toBeLessThan(0.2)             // почти чёрный
    expect(fx.object3d.visible).toBe(true)
  })

  it('сдувание (после выстрела): вспышка видима, масштаб возвращается к 1', () => {
    const fx = new SingularityWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame({ progress: 0, shrink: 0.1 }))
    expect(fx.object3d.visible).toBe(true)                   // вспышка коллапса
    fx.apply(0.016, t, makeFrame({ progress: 0, shrink: 1 }))
    expect(t.mesh.scale.x).toBe(1)
    expect(fx.object3d.visible).toBe(false)
  })

  it('вихрь центрируется на origin', () => {
    const fx = new SingularityWindupFx()
    fx.apply(0.016, makeTarget(), makeFrame({ progress: 0.5, origin: new THREE.Vector3(3, 1, -2) }))
    expect(fx.object3d.position.toArray()).toEqual([3, 1, -2])
  })

  it('меши/частицы noRaycast, dispose не бросает', () => {
    const fx = new SingularityWindupFx()
    fx.object3d.traverse(o => { if (o !== fx.object3d) expect(o.userData.noRaycast).toBe(true) })
    expect(() => fx.dispose()).not.toThrow()
  })
})

describe('createWindupFx', () => {
  it('возвращает реализацию по стилю', () => {
    expect(createWindupFx('classic')).toBeInstanceOf(ClassicWindupFx)
    expect(createWindupFx('rage')).toBeInstanceOf(RageWindupFx)
    expect(createWindupFx('singularity')).toBeInstanceOf(SingularityWindupFx)
  })
})
