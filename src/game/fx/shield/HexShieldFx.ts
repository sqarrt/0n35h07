import * as THREE from 'three'
import type { IShieldFx } from './types'

// СОТЫ: sci-fi-щит из шестиугольных плиток-панелей на сфере. При активации плитки вспыхивают
// волной сверху вниз, затем держатся полупрозрачно с лёгким мерцанием (плавным, не стробящим).
const HEX_COLOR         = '#4af'
const HEX_RADIUS        = 0.78   // радиус сферы щита (как у купола)
const HEX_TILES         = 36     // число плиток (фибоначчи-распределение по сфере)
const HEX_TILE_R        = 0.22   // радиус плитки (описанная окружность шестиугольника)
const HEX_BASE_OPACITY  = 0.18   // дежурная непрозрачность плитки
const HEX_FLASH_OPACITY = 0.85   // непрозрачность в момент вспышки волны
const HEX_WAVE_MS       = 350    // волна активации пробегает сверху вниз
const HEX_FLASH_MS      = 200    // затухание вспышки одной плитки
const HEX_SHIMMER_AMP   = 0.06   // амплитуда дежурного мерцания
const HEX_SHIMMER_RATE  = 0.004  // темп мерцания (рад/мс) — плавный, без строба
const HEX_PHASE_STEP    = 2.4    // разбег фаз мерцания между плитками (рад)

interface Tile {
  mat:   THREE.MeshBasicMaterial
  delay: number   // мс от старта волны до вспышки (по широте: верх → низ)
  phase: number   // фаза дежурного мерцания
}

export class HexShieldFx implements IShieldFx {
  readonly object3d = new THREE.Group()
  private geometry: THREE.CircleGeometry
  private tiles: Tile[] = []
  private wasActive = false
  private activeMs = 0   // мс с момента активации — прогресс волны

  constructor() {
    this.geometry = new THREE.CircleGeometry(HEX_TILE_R, 6)   // «шестиугольник» = круг из 6 сегментов
    const center = new THREE.Vector3()
    for (let i = 0; i < HEX_TILES; i++) {
      // Фибоначчи-сфера: равномерные направления; y убывает → плитка 0 у макушки.
      const y = 1 - (2 * (i + 0.5)) / HEX_TILES
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const a = i * Math.PI * (3 - Math.sqrt(5))   // золотой угол
      const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)

      const mat = new THREE.MeshBasicMaterial({
        color: HEX_COLOR, transparent: true, opacity: HEX_BASE_OPACITY,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const tile = new THREE.Mesh(this.geometry, mat)
      tile.position.copy(dir).multiplyScalar(HEX_RADIUS)
      tile.lookAt(center)   // плитка касательна сфере (нормаль по радиусу)
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
    if (!this.wasActive) { this.wasActive = true; this.activeMs = 0 }   // фронт активации → новая волна
    this.activeMs += dt * 1000
    for (const t of this.tiles) {
      const flashT = (this.activeMs - t.delay) / HEX_FLASH_MS          // <0 — волна не дошла, >1 — отгорела
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
