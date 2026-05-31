import * as THREE from 'three'
import type { IShield } from './abstractions'
import { SHIELD_DURATION, SHIELD_COOLDOWN } from '../constants'

interface ShieldConfig { duration?: number; cooldown?: number }

/** Щит: idle → active(duration) → cooldown. dt-driven, без setTimeout. Владеет пузырём. */
export class Shield implements IShield {
  readonly object3d = new THREE.Group()
  private fillMat: THREE.MeshBasicMaterial
  private wireMat: THREE.MeshBasicMaterial

  private phase: 'idle' | 'active' | 'cooldown' = 'idle'
  private timer = 0   // мс в текущей фазе
  private readonly duration: number
  private readonly cooldown: number

  constructor(cfg: ShieldConfig = {}) {
    this.duration = cfg.duration ?? SHIELD_DURATION
    this.cooldown = cfg.cooldown ?? SHIELD_COOLDOWN

    this.fillMat = new THREE.MeshBasicMaterial({
      color: '#4af', transparent: true, opacity: 0.1,
      side: THREE.DoubleSide, depthWrite: false,
    })
    this.wireMat = new THREE.MeshBasicMaterial({
      color: '#4af', wireframe: true, transparent: true, opacity: 0.4, depthWrite: false,
    })
    const fill = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16), this.fillMat)
    const wire = new THREE.Mesh(new THREE.SphereGeometry(0.76, 12, 8), this.wireMat)
    fill.userData.noRaycast = true
    wire.userData.noRaycast = true
    this.object3d.add(fill, wire)
    this.object3d.visible = false
  }

  activate() {
    if (this.phase !== 'idle') return
    this.phase = 'active'
    this.timer = 0
  }

  update(dt: number) {
    const ms = dt * 1000
    if (this.phase === 'active') {
      this.timer += ms
      if (this.timer >= this.duration) { this.phase = 'cooldown'; this.timer = 0 }
    } else if (this.phase === 'cooldown') {
      this.timer += ms
      if (this.timer >= this.cooldown) { this.phase = 'idle'; this.timer = 0 }
    }

    const on = this.phase === 'active'
    this.object3d.visible = on
    if (on) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.007)
      this.fillMat.opacity = 0.08 + 0.1 * pulse
      this.wireMat.opacity = 0.3 + 0.3 * pulse
    }
  }

  get isActive() { return this.phase === 'active' }

  progress(): number {
    if (this.phase === 'idle') return 1
    const total = this.duration + this.cooldown
    const elapsed = this.phase === 'active' ? this.timer : this.duration + this.timer
    return Math.max(0, Math.min(1, elapsed / total))
  }

  reset() {
    this.phase = 'idle'
    this.timer = 0
    this.object3d.visible = false
  }

  dispose() {
    this.object3d.children.forEach(c => (c as THREE.Mesh).geometry.dispose())
    this.fillMat.dispose()
    this.wireMat.dispose()
  }
}
