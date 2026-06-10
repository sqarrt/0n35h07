import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { EchoRespawnFx } from '../../src/game/fx/respawn/EchoRespawnFx'
import type { RespawnFrame, RespawnTarget } from '../../src/game/fx/respawn/types'
import { GHOST_OPACITY, SPAWN_ANIM_MS } from '../../src/constants'

export function makeTarget(color = '#4af') {
  const material = new THREE.MeshStandardMaterial({ color, transparent: true })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), material)
  let opacity = 1
  const target: RespawnTarget = { mesh, material, setOpacity: (o: number) => { opacity = o; material.opacity = o } }
  return { target, mesh, material, getOpacity: () => opacity }
}

export const makeFrame = (over: Partial<RespawnFrame> = {}): RespawnFrame => ({
  ghost: null, sinceRebirthMs: SPAWN_ANIM_MS * 10, baseColor: new THREE.Color('#4af'),
  origin: new THREE.Vector3(), visible: true, ...over,
})

describe('EchoRespawnFx', () => {
  it('призрак: полупрозрачный, масштаб 1, цвет базовый', () => {
    const fx = new EchoRespawnFx('#4af')
    const { target, mesh, getOpacity } = makeTarget()
    mesh.scale.setScalar(1.3)
    fx.apply(0.016, target, makeFrame({ ghost: 0.7 }))
    expect(getOpacity()).toBeCloseTo(GHOST_OPACITY)
    expect(mesh.scale.x).toBe(1)
  })

  it('возрождение: «пуф» масштаба в окне SPAWN_ANIM_MS, потом окно закрыто', () => {
    const fx = new EchoRespawnFx('#4af')
    const { target, mesh } = makeTarget()
    fx.apply(0.016, target, makeFrame({ sinceRebirthMs: SPAWN_ANIM_MS / 2 }))
    expect(mesh.scale.x).toBeGreaterThan(1)                     // всплеск
    expect(fx.isRebirthActive(SPAWN_ANIM_MS / 2)).toBe(true)
    expect(fx.isRebirthActive(SPAWN_ANIM_MS + 1)).toBe(false)
  })

  it('обычный кадр: no-op (масштабом/цветом владеет windup)', () => {
    const fx = new EchoRespawnFx('#4af')
    const { target, mesh, material } = makeTarget()
    mesh.scale.setScalar(1.25)                                  // как будто идёт заряд
    material.color.set('#fff')
    fx.apply(0.016, target, makeFrame())
    expect(mesh.scale.x).toBeCloseTo(1.25)                      // не тронул
    expect(material.color.getHexString()).toBe('ffffff')
  })

  it('onDeath активирует частицы хлопка (world-часть), update их гасит со временем', () => {
    const fx = new EchoRespawnFx('#4af')
    fx.onDeath(new THREE.Vector3(1, 2, 3))
    let visibleNow = 0
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visibleNow++ })
    expect(visibleNow).toBeGreaterThan(0)
    for (let i = 0; i < 200; i++) fx.update(0.016)              // ~3.2с — дольше жизни частиц
    let visibleAfter = 0
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visibleAfter++ })
    expect(visibleAfter).toBe(0)
  })

  it('частицы noRaycast, dispose не бросает', () => {
    const fx = new EchoRespawnFx('#4af')
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh) expect(o.userData.noRaycast).toBe(true) })
    expect(() => fx.dispose()).not.toThrow()
  })
})
