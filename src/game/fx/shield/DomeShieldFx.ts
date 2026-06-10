import * as THREE from 'three'
import type { IShieldFx } from './types'

// КУПОЛ: исторический пузырь щита (извлечён из Shield бит-в-бит) — заливка + каркас с пульсом.
const DOME_COLOR        = '#4af'
const FILL_RADIUS       = 0.75
const FILL_SEGMENTS     = 16
const WIRE_RADIUS       = 0.76
const WIRE_SEGMENTS_W   = 12
const WIRE_SEGMENTS_H   = 8
const PULSE_RATE        = 0.007  // множитель Date.now() в синусе пульса
const FILL_OPACITY_BASE = 0.08
const FILL_OPACITY_AMP  = 0.1
const WIRE_OPACITY_BASE = 0.3
const WIRE_OPACITY_AMP  = 0.3

export class DomeShieldFx implements IShieldFx {
  readonly object3d = new THREE.Group()
  private fillMat: THREE.MeshBasicMaterial
  private wireMat: THREE.MeshBasicMaterial

  constructor() {
    this.fillMat = new THREE.MeshBasicMaterial({
      color: DOME_COLOR, transparent: true, opacity: 0.1,
      side: THREE.DoubleSide, depthWrite: false,
    })
    this.wireMat = new THREE.MeshBasicMaterial({
      color: DOME_COLOR, wireframe: true, transparent: true, opacity: 0.4, depthWrite: false,
    })
    const fill = new THREE.Mesh(new THREE.SphereGeometry(FILL_RADIUS, FILL_SEGMENTS, FILL_SEGMENTS), this.fillMat)
    const wire = new THREE.Mesh(new THREE.SphereGeometry(WIRE_RADIUS, WIRE_SEGMENTS_W, WIRE_SEGMENTS_H), this.wireMat)
    fill.userData.noRaycast = true
    wire.userData.noRaycast = true
    this.object3d.add(fill, wire)
  }

  update(_dt: number, active: boolean) {
    if (!active) return
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * PULSE_RATE)
    this.fillMat.opacity = FILL_OPACITY_BASE + FILL_OPACITY_AMP * pulse
    this.wireMat.opacity = WIRE_OPACITY_BASE + WIRE_OPACITY_AMP * pulse
  }

  dispose() {
    this.object3d.children.forEach(c => (c as THREE.Mesh).geometry.dispose())
    this.fillMat.dispose()
    this.wireMat.dispose()
  }
}
