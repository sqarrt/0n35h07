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
  it('neutral frame: scale=1, color=base, emissive black', () => {
    const fx = new ClassicWindupFx()
    const t = makeTarget()
    t.mesh.scale.setScalar(1.4)                      // "dirty" state left from a previous charge
    t.material.emissive.setRGB(1, 0, 0)
    fx.apply(0.016, t, makeFrame())
    expect(t.mesh.scale.x).toBe(1)
    expect(t.material.color.getHexString()).toBe(new THREE.Color('#4af').getHexString())
    expect(t.material.emissive.getHex()).toBe(0)
  })

  it('charge: inflates with progress, color shifts toward white', () => {
    const fx = new ClassicWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame({ progress: 1 }))
    expect(t.mesh.scale.x).toBeCloseTo(1 + WINDUP_SCALE_GAIN)
    expect(t.material.color.getHexString()).toBe(new THREE.Color(BOT_COLOR_WHITE).getHexString())
  })

  it('deflation: scale falls with shrink, color is already base', () => {
    const fx = new ClassicWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame({ progress: 0, shrink: 0.5 }))
    expect(t.mesh.scale.x).toBeCloseTo(1 + WINDUP_SCALE_GAIN * 0.5)
    expect(t.material.color.getHexString()).toBe(new THREE.Color('#4af').getHexString())
  })

  it('no world-space part (empty group), dispose does not throw', () => {
    const fx = new ClassicWindupFx()
    expect(fx.object3d.children.length).toBe(0)
    expect(() => fx.dispose()).not.toThrow()
  })
})

describe('RageWindupFx', () => {
  it('neutral frame: scale=1, color=base, emissive black, jaws hidden', () => {
    const fx = new RageWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame())
    expect(t.mesh.scale.x).toBe(1)
    expect(t.material.color.getHexString()).toBe(new THREE.Color('#4af').getHexString())
    expect(t.material.emissive.getHex()).toBe(0)
    expect(fx.object3d.visible).toBe(false)
  })

  it('charge: ball inflates and darkens, emissive red, jaws visible and open up', () => {
    const fx = new RageWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame({ progress: 0.3 }))
    // children[0] — upper jaw (add order in the constructor)
    const openEarly = fx.object3d.children[0].position.y
    fx.apply(0.016, t, makeFrame({ progress: 1 }))
    expect(t.mesh.scale.x).toBeGreaterThan(1)
    expect(t.material.emissive.r).toBeGreaterThan(0)        // white-hot glow
    expect(t.material.color.r).toBeLessThan(0.5)            // darkened (not whitening like classic)
    expect(fx.object3d.visible).toBe(true)
    // children[0] — upper jaw (add order in the constructor)
    expect(fx.object3d.children[0].position.y).toBeGreaterThan(openEarly)   // mouth opens further
  })

  it('visible=false (FP) hides the jaws even while charging', () => {
    const fx = new RageWindupFx()
    fx.apply(0.016, makeTarget(), makeFrame({ progress: 0.5, visible: false }))
    expect(fx.object3d.visible).toBe(false)
  })

  it('jaws are positioned in front of the ball along aimDir', () => {
    const fx = new RageWindupFx()
    fx.apply(0.016, makeTarget(), makeFrame({
      progress: 0.5,
      origin: new THREE.Vector3(10, 2, 0),
      aimDir: new THREE.Vector3(0, 0, -1),
    }))
    expect(fx.object3d.position.x).toBeCloseTo(10)
    expect(fx.object3d.position.z).toBeLessThan(0)          // pushed forward along the gaze
  })

  it('all meshes are marked noRaycast, dispose does not throw', () => {
    const fx = new RageWindupFx()
    let meshes = 0
    fx.object3d.traverse(o => { if ((o as THREE.Mesh).isMesh) { meshes++; expect(o.userData.noRaycast).toBe(true) } })
    expect(meshes).toBeGreaterThan(0)
    expect(() => fx.dispose()).not.toThrow()
  })

  it('jaw orientation is correct even under a shifted/scaled parent (menu preview)', () => {
    const fx = new RageWindupFx()
    const parent = new THREE.Group()           // like the ball group in the preview: shift + uniform scale
    parent.position.set(5, 0, 0)
    parent.scale.setScalar(3)
    parent.add(fx.object3d)
    parent.updateMatrixWorld(true)
    const forward = new THREE.Vector3(0, 0, -1)
    fx.apply(0.016, makeTarget(), makeFrame({ progress: 0.5, aimDir: forward.clone() }))
    parent.updateMatrixWorld(true)
    // The jaws' world +Z axis (lookAt turns +Z toward the target) must coincide with forward.
    const worldZ = new THREE.Vector3(0, 0, 1).applyQuaternion(fx.object3d.getWorldQuaternion(new THREE.Quaternion()))
    expect(worldZ.dot(forward)).toBeGreaterThan(0.99)
  })
})

describe('SingularityWindupFx', () => {
  it('neutral frame: scale=1, color=base, vortex hidden', () => {
    const fx = new SingularityWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame())
    expect(t.mesh.scale.x).toBe(1)
    expect(t.material.color.getHexString()).toBe(new THREE.Color('#4af').getHexString())
    expect(fx.object3d.visible).toBe(false)
  })

  it('charge: ball SHRINKS (but not to zero) and darkens, vortex visible', () => {
    const fx = new SingularityWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame({ progress: 1 }))
    expect(t.mesh.scale.x).toBeLessThan(1)
    expect(t.mesh.scale.x).toBeGreaterThan(0.3)
    expect(t.material.color.r).toBeLessThan(0.2)             // almost black
    expect(fx.object3d.visible).toBe(true)
  })

  it('deflation (after the shot): flash visible, scale returns to 1', () => {
    const fx = new SingularityWindupFx()
    const t = makeTarget()
    fx.apply(0.016, t, makeFrame({ progress: 0, shrink: 0.1 }))
    expect(fx.object3d.visible).toBe(true)                   // collapse flash
    fx.apply(0.016, t, makeFrame({ progress: 0, shrink: 1 }))
    expect(t.mesh.scale.x).toBe(1)
    expect(fx.object3d.visible).toBe(false)
  })

  it('vortex is centered on origin', () => {
    const fx = new SingularityWindupFx()
    fx.apply(0.016, makeTarget(), makeFrame({ progress: 0.5, origin: new THREE.Vector3(3, 1, -2) }))
    expect(fx.object3d.position.toArray()).toEqual([3, 1, -2])
  })

  it('meshes/particles noRaycast, dispose does not throw', () => {
    const fx = new SingularityWindupFx()
    fx.object3d.traverse(o => { if (o !== fx.object3d) expect(o.userData.noRaycast).toBe(true) })
    expect(() => fx.dispose()).not.toThrow()
  })
})

describe('createWindupFx', () => {
  it('returns implementation by style', () => {
    expect(createWindupFx('classic')).toBeInstanceOf(ClassicWindupFx)
    expect(createWindupFx('rage')).toBeInstanceOf(RageWindupFx)
    expect(createWindupFx('singularity')).toBeInstanceOf(SingularityWindupFx)
  })
})
