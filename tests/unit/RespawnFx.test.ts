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

import { ChaosRespawnFx } from '../../src/game/fx/respawn/ChaosRespawnFx'

describe('ChaosRespawnFx', () => {
  it('призрак: меш дёргается в пределах лимита (смещение ≠ 0, ограничено)', () => {
    const fx = new ChaosRespawnFx('#4af')
    const { target, mesh } = makeTarget()
    const base = mesh.position.clone()
    let moved = false
    for (let i = 0; i < 40; i++) {                              // ~0.64с — джиттер успевает тикнуть
      fx.apply(0.016, target, makeFrame({ ghost: 0.5 }))
      const d = mesh.position.distanceTo(base)
      expect(d).toBeLessThan(1)                                 // лимит джиттера
      if (d > 1e-4) moved = true
    }
    expect(moved).toBe(true)
  })

  it('после возрождения смещение меша обнулено, visible/opacity восстановлены', () => {
    const fx = new ChaosRespawnFx('#4af')
    const { target, mesh, getOpacity } = makeTarget()
    const base = mesh.position.clone()
    for (let i = 0; i < 20; i++) fx.apply(0.016, target, makeFrame({ ghost: 0.3 }))
    for (let i = 0; i < 60; i++) fx.apply(0.016, target, makeFrame({ sinceRebirthMs: i * 16 }))   // сборка
    fx.apply(0.016, target, makeFrame())                        // первый кадр вне фаз — восстановление
    expect(mesh.position.distanceTo(base)).toBeLessThan(1e-6)
    expect(mesh.visible).toBe(true)
    expect(getOpacity()).toBe(1)
  })

  it('isRebirthActive ограничен своим окном; dispose не бросает', () => {
    const fx = new ChaosRespawnFx('#4af')
    expect(fx.isRebirthActive(0)).toBe(true)
    expect(fx.isRebirthActive(10_000)).toBe(false)
    expect(() => fx.dispose()).not.toThrow()
  })
})

import { SwarmRespawnFx } from '../../src/game/fx/respawn/SwarmRespawnFx'

describe('SwarmRespawnFx', () => {
  it('призрак: шар скрыт, рой видим и следует за origin', () => {
    const fx = new SwarmRespawnFx('#4af')
    const { target, mesh } = makeTarget()
    fx.onDeath(new THREE.Vector3(0, 1, 0))
    fx.apply(0.016, target, makeFrame({ ghost: 0.8, origin: new THREE.Vector3(0, 1, 0) }))
    expect(mesh.visible).toBe(false)
    expect(fx.object3d.visible).toBe(true)
    // Рой следует за игроком: сместить origin → центр масс осколков смещается следом.
    const centroid = () => {
      const c = new THREE.Vector3(); let n = 0
      fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh) { c.add(o.getWorldPosition(new THREE.Vector3())); n++ } })
      return c.divideScalar(n)
    }
    for (let i = 0; i < 30; i++) fx.apply(0.016, target, makeFrame({ ghost: 0.5, origin: new THREE.Vector3(0, 1, 0) }))
    const before = centroid()
    for (let i = 0; i < 60; i++) fx.apply(0.016, target, makeFrame({ ghost: 0.3, origin: new THREE.Vector3(6, 1, 0) }))
    const after = centroid()
    expect(after.x - before.x).toBeGreaterThan(2)               // рой переехал за origin
  })

  it('возрождение: к концу окна шар видим, рой скрыт', () => {
    const fx = new SwarmRespawnFx('#4af')
    const { target, mesh } = makeTarget()
    fx.onDeath(new THREE.Vector3())
    fx.apply(0.016, target, makeFrame({ ghost: 0.1 }))
    for (let i = 0; i <= 40; i++) fx.apply(0.016, target, makeFrame({ sinceRebirthMs: i * 16 }))
    fx.apply(0.016, target, makeFrame())                        // первый кадр вне фаз
    expect(mesh.visible).toBe(true)
    expect(fx.object3d.visible).toBe(false)
  })

  it('FP (visible=false): рой скрыт даже в призраке; осколки noRaycast; dispose ок', () => {
    const fx = new SwarmRespawnFx('#4af')
    const { target } = makeTarget()
    fx.onDeath(new THREE.Vector3())
    fx.apply(0.016, target, makeFrame({ ghost: 0.5, visible: false }))
    expect(fx.object3d.visible).toBe(false)
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh) expect(o.userData.noRaycast).toBe(true) })
    expect(() => fx.dispose()).not.toThrow()
  })
})

import { createRespawnFx } from '../../src/game/fx/respawn/createRespawnFx'

describe('createRespawnFx', () => {
  it('возвращает реализацию по стилю', () => {
    expect(createRespawnFx('echo', '#4af')).toBeInstanceOf(EchoRespawnFx)
    expect(createRespawnFx('chaos', '#4af')).toBeInstanceOf(ChaosRespawnFx)
    expect(createRespawnFx('swarm', '#4af')).toBeInstanceOf(SwarmRespawnFx)
  })
})

describe('след призрака по стилям', () => {
  it('echo/chaos: каждый рисует СОБСТВЕННЫЙ след призрака (клоны в своём object3d)', () => {
    for (const make of [() => new EchoRespawnFx('#4af'), () => new ChaosRespawnFx('#4af')]) {
      const fx = make()
      const { target } = makeTarget()
      // Призрак движется → собственный трейл стратегии эмитит клоны.
      for (let i = 0; i < 5; i++) fx.apply(0.016, target, makeFrame({ ghost: 0.5, origin: new THREE.Vector3(i, 1, 0) }))
      let visible = 0
      fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visible++ })
      expect(visible).toBeGreaterThan(0)
      // Вне призрака клоны гаснут со временем (трейл тикает в apply).
      for (let i = 0; i < 60; i++) fx.apply(0.016, target, makeFrame())
      visible = 0
      fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visible++ })
      expect(visible).toBe(0)
    }
  })

  it('echo/chaos: в FP (visible=false) собственный след призрака не эмитится', () => {
    for (const make of [() => new EchoRespawnFx('#4af'), () => new ChaosRespawnFx('#4af')]) {
      const fx = make()
      const { target } = makeTarget()
      for (let i = 0; i < 5; i++) fx.apply(0.016, target, makeFrame({ ghost: 0.5, origin: new THREE.Vector3(i, 1, 0), visible: false }))
      let visible = 0
      fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visible++ })
      expect(visible).toBe(0)
    }
  })

  it('swarm: в призраке появляются клоны следа (видимых мешей больше, чем 60 осколков)', () => {
    const fx = new SwarmRespawnFx('#4af')
    const { target } = makeTarget()
    fx.onDeath(new THREE.Vector3())
    for (let i = 0; i < 20; i++) { fx.apply(0.016, target, makeFrame({ ghost: 0.5 })); fx.update(0.016) }
    let visible = 0
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visible++ })
    expect(visible).toBeGreaterThan(60)
  })
})
