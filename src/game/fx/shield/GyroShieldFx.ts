import * as THREE from 'three'
import type { IShieldFx } from './types'

// ОРБИТЫ: три гироскоп-кольца вокруг тела, кувыркаются вокруг разнесённых осей с разными скоростями.
const GYRO_COLOR     = '#4af'
const GYRO_RADIUS    = 0.78
const GYRO_TUBE      = 0.02
const GYRO_SEG_TUBE  = 8
const GYRO_SEG_RING  = 48
// Базовые наклоны осей (рад). Ось вращения — локальная X спин-группы: она лежит В плоскости
// кольца (нормаль тора — Z), поэтому вращение кувыркает плоскость кольца, а не крутит его в себе.
const GYRO_TILTS_X  = [Math.PI / 2, Math.PI / 6, -Math.PI / 3]
const GYRO_TILTS_Y  = [0, Math.PI / 3, -Math.PI / 4]
const GYRO_SPEEDS   = [1.6, -2.2, 2.9]   // рад/с
const PULSE_RATE         = 0.007  // тот же темп пульса, что у купола
const GYRO_OPACITY_BASE  = 0.55
const GYRO_OPACITY_AMP   = 0.25

export class GyroShieldFx implements IShieldFx {
  readonly object3d = new THREE.Group()
  private spins: THREE.Group[] = []
  private mats: THREE.MeshBasicMaterial[] = []
  private geometry: THREE.TorusGeometry

  constructor() {
    this.geometry = new THREE.TorusGeometry(GYRO_RADIUS, GYRO_TUBE, GYRO_SEG_TUBE, GYRO_SEG_RING)
    for (let i = 0; i < GYRO_SPEEDS.length; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: GYRO_COLOR, transparent: true, opacity: GYRO_OPACITY_BASE,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const tilt = new THREE.Group()
      tilt.rotation.set(GYRO_TILTS_X[i], GYRO_TILTS_Y[i], 0)
      const spin = new THREE.Group()
      const ring = new THREE.Mesh(this.geometry, mat)
      ring.userData.noRaycast = true
      spin.add(ring)
      tilt.add(spin)
      this.object3d.add(tilt)
      this.spins.push(spin)
      this.mats.push(mat)
    }
  }

  update(dt: number, active: boolean) {
    if (!active) return
    this.spins.forEach((spin, i) => { spin.rotation.x += GYRO_SPEEDS[i] * dt })
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * PULSE_RATE)
    this.mats.forEach(m => { m.opacity = GYRO_OPACITY_BASE + GYRO_OPACITY_AMP * (pulse - 0.5) })
  }

  dispose() {
    this.geometry.dispose()
    this.mats.forEach(m => m.dispose())
  }
}
