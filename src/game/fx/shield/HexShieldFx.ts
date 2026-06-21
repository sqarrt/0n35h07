import * as THREE from 'three'
import type { IShieldFx } from './types'

// HEX: sci-fi shield of hexagonal panel tiles on a sphere. On activation the tiles flash in a
// top-to-bottom wave, then stay translucent with a faint shimmer (smooth, not strobing).
const HEX_COLOR         = '#4af'
const HEX_RADIUS        = 0.78   // shield sphere radius (same as the dome)
const HEX_TILES         = 36     // tile count (Fibonacci distribution over the sphere)
const HEX_TILE_R        = 0.22   // tile radius (circumscribed circle of the hexagon)
const HEX_BASE_OPACITY  = 0.18   // idle tile opacity
const HEX_FLASH_OPACITY = 0.85   // opacity at the wave flash peak
const HEX_WAVE_MS       = 350    // activation wave sweeps top to bottom
const HEX_FLASH_MS      = 200    // flash fade-out of a single tile
const HEX_SHIMMER_AMP   = 0.06   // idle shimmer amplitude
const HEX_SHIMMER_RATE  = 0.004  // shimmer rate (rad/ms) — smooth, no strobe
const HEX_PHASE_STEP    = 2.4    // shimmer phase spread between tiles (rad)

interface Tile {
  mat:   THREE.MeshBasicMaterial
  delay: number   // ms from wave start to flash (by latitude: top → bottom)
  phase: number   // idle shimmer phase
}

export class HexShieldFx implements IShieldFx {
  readonly object3d = new THREE.Group()
  private geometry: THREE.CircleGeometry
  private tiles: Tile[] = []
  private wasActive = false
  private activeMs = 0   // ms since activation — wave progress

  constructor() {
    this.geometry = new THREE.CircleGeometry(HEX_TILE_R, 6)   // "hexagon" = circle of 6 segments
    const center = new THREE.Vector3()
    for (let i = 0; i < HEX_TILES; i++) {
      // Fibonacci sphere: even directions; y decreases → tile 0 at the top.
      const y = 1 - (2 * (i + 0.5)) / HEX_TILES
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const a = i * Math.PI * (3 - Math.sqrt(5))   // golden angle
      const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)

      const mat = new THREE.MeshBasicMaterial({
        color: HEX_COLOR, transparent: true, opacity: HEX_BASE_OPACITY,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const tile = new THREE.Mesh(this.geometry, mat)
      tile.position.copy(dir).multiplyScalar(HEX_RADIUS)
      tile.lookAt(center)   // tile tangent to the sphere (normal along the radius)
      tile.userData.noRaycast = true
      this.object3d.add(tile)
      this.tiles.push({
        mat,
        delay: (Math.acos(THREE.MathUtils.clamp(y, -1, 1)) / Math.PI) * HEX_WAVE_MS,
        phase: i * HEX_PHASE_STEP,
      })
    }
  }

  update(dt: number, active: boolean) {
    if (!active) { this.wasActive = false; return }
    if (!this.wasActive) { this.wasActive = true; this.activeMs = 0 }   // activation edge → new wave
    this.activeMs += dt * 1000
    for (const t of this.tiles) {
      const flashT = (this.activeMs - t.delay) / HEX_FLASH_MS          // <0 — wave not yet here, >1 — burned out
      const flash = flashT >= 0 && flashT < 1 ? 1 - flashT : 0
      const shimmer = HEX_SHIMMER_AMP * Math.sin(this.activeMs * HEX_SHIMMER_RATE + t.phase)
      t.mat.opacity = HEX_BASE_OPACITY + shimmer + (HEX_FLASH_OPACITY - HEX_BASE_OPACITY) * flash
    }
  }

  dispose() {
    this.geometry.dispose()
    this.tiles.forEach(t => t.mat.dispose())
  }
}
