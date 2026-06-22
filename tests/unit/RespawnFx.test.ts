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
  it('ghost: semi-transparent, scale 1, base color', () => {
    const fx = new EchoRespawnFx('#4af')
    const { target, mesh, getOpacity } = makeTarget()
    mesh.scale.setScalar(1.3)
    fx.apply(0.016, target, makeFrame({ ghost: 0.7 }))
    expect(getOpacity()).toBeCloseTo(GHOST_OPACITY)
    expect(mesh.scale.x).toBe(1)
  })

  it('rebirth: scale "poof" within the SPAWN_ANIM_MS window, then window closed', () => {
    const fx = new EchoRespawnFx('#4af')
    const { target, mesh } = makeTarget()
    fx.apply(0.016, target, makeFrame({ sinceRebirthMs: SPAWN_ANIM_MS / 2 }))
    expect(mesh.scale.x).toBeGreaterThan(1)                     // burst
    expect(fx.isRebirthActive(SPAWN_ANIM_MS / 2)).toBe(true)
    expect(fx.isRebirthActive(SPAWN_ANIM_MS + 1)).toBe(false)
  })

  it('regular frame: no-op (scale/color owned by windup)', () => {
    const fx = new EchoRespawnFx('#4af')
    const { target, mesh, material } = makeTarget()
    mesh.scale.setScalar(1.25)                                  // as if charging
    material.color.set('#fff')
    fx.apply(0.016, target, makeFrame())
    expect(mesh.scale.x).toBeCloseTo(1.25)                      // untouched
    expect(material.color.getHexString()).toBe('ffffff')
  })

  it('onDeath activates burst particles (world part), update fades them over time', () => {
    const fx = new EchoRespawnFx('#4af')
    fx.onDeath(new THREE.Vector3(1, 2, 3))
    let visibleNow = 0
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visibleNow++ })
    expect(visibleNow).toBeGreaterThan(0)
    for (let i = 0; i < 200; i++) fx.update(0.016)              // ~3.2s — longer than particle lifetime
    let visibleAfter = 0
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visibleAfter++ })
    expect(visibleAfter).toBe(0)
  })

  it('particles noRaycast, dispose does not throw', () => {
    const fx = new EchoRespawnFx('#4af')
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh) expect(o.userData.noRaycast).toBe(true) })
    expect(() => fx.dispose()).not.toThrow()
  })
})

import { ChaosRespawnFx } from '../../src/game/fx/respawn/ChaosRespawnFx'

describe('ChaosRespawnFx', () => {
  it('ghost: mesh jitters within a limit (offset != 0, bounded)', () => {
    const fx = new ChaosRespawnFx('#4af')
    const { target, mesh } = makeTarget()
    const base = mesh.position.clone()
    let moved = false
    for (let i = 0; i < 40; i++) {                              // ~0.64s — enough for the jitter to tick
      fx.apply(0.016, target, makeFrame({ ghost: 0.5 }))
      const d = mesh.position.distanceTo(base)
      expect(d).toBeLessThan(1)                                 // jitter limit
      if (d > 1e-4) moved = true
    }
    expect(moved).toBe(true)
  })

  it('after rebirth mesh offset is zeroed, visible/opacity restored', () => {
    const fx = new ChaosRespawnFx('#4af')
    const { target, mesh, getOpacity } = makeTarget()
    const base = mesh.position.clone()
    for (let i = 0; i < 20; i++) fx.apply(0.016, target, makeFrame({ ghost: 0.3 }))
    for (let i = 0; i < 60; i++) fx.apply(0.016, target, makeFrame({ sinceRebirthMs: i * 16 }))   // reassembly
    fx.apply(0.016, target, makeFrame())                        // first frame outside phases — restore
    expect(mesh.position.distanceTo(base)).toBeLessThan(1e-6)
    expect(mesh.visible).toBe(true)
    expect(getOpacity()).toBe(1)
  })

  it('isRebirthActive bounded by its window; dispose does not throw', () => {
    const fx = new ChaosRespawnFx('#4af')
    expect(fx.isRebirthActive(0)).toBe(true)
    expect(fx.isRebirthActive(10_000)).toBe(false)
    expect(() => fx.dispose()).not.toThrow()
  })
})

import { SwarmRespawnFx } from '../../src/game/fx/respawn/SwarmRespawnFx'

describe('SwarmRespawnFx', () => {
  it('ghost: ball hidden, swarm visible and follows origin', () => {
    const fx = new SwarmRespawnFx('#4af')
    const { target, mesh } = makeTarget()
    fx.onDeath(new THREE.Vector3(0, 1, 0))
    fx.apply(0.016, target, makeFrame({ ghost: 0.8, origin: new THREE.Vector3(0, 1, 0) }))
    expect(mesh.visible).toBe(false)
    expect(fx.object3d.visible).toBe(true)
    // Swarm follows the player: shift origin → shards' center of mass shifts along.
    const centroid = () => {
      const c = new THREE.Vector3(); let n = 0
      fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh) { c.add(o.getWorldPosition(new THREE.Vector3())); n++ } })
      return c.divideScalar(n)
    }
    for (let i = 0; i < 30; i++) fx.apply(0.016, target, makeFrame({ ghost: 0.5, origin: new THREE.Vector3(0, 1, 0) }))
    const before = centroid()
    for (let i = 0; i < 60; i++) fx.apply(0.016, target, makeFrame({ ghost: 0.3, origin: new THREE.Vector3(6, 1, 0) }))
    const after = centroid()
    expect(after.x - before.x).toBeGreaterThan(2)               // swarm moved after origin
  })

  it('rebirth: by the end of the window the ball is visible, swarm hidden', () => {
    const fx = new SwarmRespawnFx('#4af')
    const { target, mesh } = makeTarget()
    fx.onDeath(new THREE.Vector3())
    fx.apply(0.016, target, makeFrame({ ghost: 0.1 }))
    for (let i = 0; i <= 40; i++) fx.apply(0.016, target, makeFrame({ sinceRebirthMs: i * 16 }))
    fx.apply(0.016, target, makeFrame())                        // first frame outside phases
    expect(mesh.visible).toBe(true)
    expect(fx.object3d.visible).toBe(false)
  })

  it('FP (visible=false): swarm hidden even in ghost; shards noRaycast; dispose ok', () => {
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
  it('returns implementation by style', () => {
    expect(createRespawnFx('echo', '#4af')).toBeInstanceOf(EchoRespawnFx)
    expect(createRespawnFx('chaos', '#4af')).toBeInstanceOf(ChaosRespawnFx)
    expect(createRespawnFx('swarm', '#4af')).toBeInstanceOf(SwarmRespawnFx)
  })
})

describe('ghost trail by style', () => {
  it('echo/chaos: each draws its OWN ghost trail (clones in its own object3d)', () => {
    for (const make of [() => new EchoRespawnFx('#4af'), () => new ChaosRespawnFx('#4af')]) {
      const fx = make()
      const { target } = makeTarget()
      // Ghost moves → the strategy's own trail emits clones.
      for (let i = 0; i < 5; i++) fx.apply(0.016, target, makeFrame({ ghost: 0.5, origin: new THREE.Vector3(i, 1, 0) }))
      let visible = 0
      fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visible++ })
      expect(visible).toBeGreaterThan(0)
      // Outside ghost, clones fade over time (trail ticks in apply).
      for (let i = 0; i < 60; i++) fx.apply(0.016, target, makeFrame())
      visible = 0
      fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visible++ })
      expect(visible).toBe(0)
    }
  })

  it('echo/chaos: in FP (visible=false) the own ghost trail is not emitted', () => {
    for (const make of [() => new EchoRespawnFx('#4af'), () => new ChaosRespawnFx('#4af')]) {
      const fx = make()
      const { target } = makeTarget()
      for (let i = 0; i < 5; i++) fx.apply(0.016, target, makeFrame({ ghost: 0.5, origin: new THREE.Vector3(i, 1, 0), visible: false }))
      let visible = 0
      fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visible++ })
      expect(visible).toBe(0)
    }
  })

  it('swarm: in ghost, trail clones appear (more visible meshes than 60 shards)', () => {
    const fx = new SwarmRespawnFx('#4af')
    const { target } = makeTarget()
    fx.onDeath(new THREE.Vector3())
    for (let i = 0; i < 20; i++) { fx.apply(0.016, target, makeFrame({ ghost: 0.5 })); fx.update(0.016) }
    let visible = 0
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) visible++ })
    expect(visible).toBeGreaterThan(60)
  })
})
