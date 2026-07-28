import * as THREE from 'three'
import type { IShield } from './abstractions'
import type { IShieldFx } from './fx/shield/types'
import { DomeShieldFx } from './fx/shield/DomeShieldFx'
import { SHIELD_DURATION, SHIELD_COOLDOWN } from '../constants'

interface ShieldConfig { duration?: number; cooldown?: number; shieldFx?: IShieldFx }

// "Perfect block": a shield activated no later than this window before a beam hit rewards a cooldown reset.
const PERFECT_BLOCK_WINDOW_MS = 100

/** Shield: idle → active(duration) → cooldown. dt-driven, no setTimeout. Visuals — from the IShieldFx skin. */
export class Shield implements IShield {
  readonly object3d = new THREE.Group()
  private fx: IShieldFx

  private phase: 'idle' | 'active' | 'cooldown' = 'idle'
  private timer = 0   // ms in the current phase
  private cooldownScale = 1
  private skipCooldown = false   // armed by a cooldown reset during active → goes straight to idle after the window
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
    // Visibility forced externally (remote player from a snapshot) — read before the overwrite below:
    // the skin must animate even when the shield is "on" via a phase that isn't ours.
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

  /** Perfect block: activated no later than the window before the hit (timer in active = ms since activation). */
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
    else if (this.phase === 'active') { this.skipCooldown = true }   // after the active window — straight to idle
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
