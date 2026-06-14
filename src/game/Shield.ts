import * as THREE from 'three'
import type { IShield } from './abstractions'
import type { IShieldFx } from './fx/shield/types'
import { DomeShieldFx } from './fx/shield/DomeShieldFx'
import { SHIELD_DURATION, SHIELD_COOLDOWN } from '../constants'

interface ShieldConfig { duration?: number; cooldown?: number; shieldFx?: IShieldFx }

// «Идеальный блок»: щит, активированный не позже этого окна до попадания луча, награждает сбросом кулдаунов.
const PERFECT_BLOCK_WINDOW_MS = 100

/** Щит: idle → active(duration) → cooldown. dt-driven, без setTimeout. Визуал — у скина IShieldFx. */
export class Shield implements IShield {
  readonly object3d = new THREE.Group()
  private fx: IShieldFx

  private phase: 'idle' | 'active' | 'cooldown' = 'idle'
  private timer = 0   // мс в текущей фазе
  private cooldownScale = 1
  private skipCooldown = false   // взведён сбросом кулдаунов во время active → после окна сразу idle
  private readonly duration: number
  private readonly cooldown: number

  constructor(cfg: ShieldConfig = {}) {
    this.duration = cfg.duration ?? SHIELD_DURATION
    this.cooldown = cfg.cooldown ?? SHIELD_COOLDOWN
    this.fx = cfg.shieldFx ?? new DomeShieldFx()
    this.object3d.add(this.fx.object3d)
    this.object3d.visible = false
  }

  activate() {
    if (this.phase !== 'idle') return
    this.phase = 'active'
    this.timer = 0
    this.skipCooldown = false
  }

  update(dt: number) {
    // Видимость, форснутая извне (удалённый игрок из снапшота), — до перезаписи ниже:
    // скин должен анимироваться и когда щит «включён» не нашей фазой.
    const externallyVisible = this.object3d.visible
    const ms = dt * 1000
    if (this.phase === 'active') {
      this.timer += ms
      if (this.timer >= this.duration) {
        this.phase = this.skipCooldown ? 'idle' : 'cooldown'
        this.skipCooldown = false
        this.timer = 0
      }
    } else if (this.phase === 'cooldown') {
      this.timer += ms
      if (this.timer >= this.cooldown * this.cooldownScale) { this.phase = 'idle'; this.timer = 0 }
    }

    const on = this.phase === 'active'
    this.object3d.visible = on
    this.fx.update(dt, on || externallyVisible)
  }

  get isActive() { return this.phase === 'active' }

  /** Идеальный блок: активирован не позже окна до попадания (timer в active = мс с активации). */
  isPerfectBlock(): boolean { return this.phase === 'active' && this.timer <= PERFECT_BLOCK_WINDOW_MS }

  progress(): number {
    if (this.phase === 'idle') return 1
    const total = this.duration + this.cooldown * this.cooldownScale
    const elapsed = this.phase === 'active' ? this.timer : this.duration + this.timer
    return Math.max(0, Math.min(1, elapsed / total))
  }

  setCooldownScale(scale: number) { this.cooldownScale = scale > 0 ? scale : 1 }
  resetCooldown() {
    if (this.phase === 'cooldown') { this.phase = 'idle'; this.timer = 0 }
    else if (this.phase === 'active') { this.skipCooldown = true }   // после активного окна — сразу idle
  }

  reset() {
    this.phase = 'idle'
    this.timer = 0
    this.skipCooldown = false
    this.object3d.visible = false
  }

  dispose() {
    this.fx.dispose()
  }
}
