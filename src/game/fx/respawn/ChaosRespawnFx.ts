import * as THREE from 'three'
import { RESPAWN_GHOST_MS, BODY_MESH_Y } from '../../../constants'
import { AfterimageTrail } from '../AfterimageTrail'
import type { IRespawnFx, RespawnTarget, RespawnFrame } from './types'

// "Chaos": glitch noise. Death is a tear; ghost is a jittering flickering mesh; rebirth is a glitch reassembly.
// IMPORTANT: only the MESH (visual) jitters -- physics/network position is untouched.
const JITTER_MAX = 0.16          // max mesh offset from base (world units)
// Positional jitter is fast (not a strobe: brightness doesn't blink, only the mesh jitters).
const JITTER_INTERVAL_MS = 40
const BREAK_MS = 250             // first ms of the ghost -- "tear": amplified jitter
const BREAK_AMP = 2.5            // tear amplitude multiplier
const GHOST_OPACITY_HI = 0.4     // ghost flickers between two levels
const GHOST_OPACITY_LO = 0.15
// Brightness flicker is rate-limited separately (photosensitivity <= ~9 Hz).
const FLICKER_INTERVAL_MS = 110
const FLICKER_CHANCE = 0.35      // chance of an opacity "drop" on a flicker tick
const REBIRTH_MS = 450           // glitch-reassembly window
const REBIRTH_STEPS = 4          // reassembly opacity steps (REBIRTH_OPACITY_FROM -> 1)
const REBIRTH_OPACITY_FROM = 0.4

/** "Chaos" style: digital glitch noise instead of a smooth ghost.
 *  Ghost trail is an OWN classic AfterimageTrail (each strategy owns its own). */
export class ChaosRespawnFx implements IRespawnFx {
  readonly object3d = new THREE.Group()
  private ghostTrail: AfterimageTrail
  private trailEye = new THREE.Vector3()   // scratch: AfterimageTrail expects EYE position, origin is ball center
  private jitter = new THREE.Vector3()
  private jitterTimer = 0
  private flickerTimer = 0
  private flickerLow = false
  private basePos = new THREE.Vector3()
  private baseSaved = false
  private dirty = false                    // mesh offset/hidden -- needs restore on exit

  constructor(color: string) {             // color is for the ghost trail (the glitch effect itself is colorless)
    this.ghostTrail = new AfterimageTrail(new THREE.Color(color))
    this.object3d.add(this.ghostTrail.object3d)
  }

  onDeath(_pos: THREE.Vector3): void {
    this.jitterTimer = 0                   // tear starts instantly
  }

  apply(dt: number, t: RespawnTarget, f: RespawnFrame): void {
    // Own ghost trail (the trail shifts the eye position to the ball center itself).
    this.trailEye.copy(f.origin)
    this.trailEye.y -= BODY_MESH_Y
    this.ghostTrail.update(dt, { position: this.trailEye, dashing: f.ghost !== null && f.visible })

    if (f.ghost !== null) {
      this.saveBase(t)
      this.jitterTimer -= dt * 1000
      if (this.jitterTimer <= 0) {
        this.jitterTimer = JITTER_INTERVAL_MS
        const amp = JITTER_MAX * (this.isBreakPhase(f.ghost) ? BREAK_AMP : 1)
        this.jitter.set((Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp)
      }
      this.flickerTimer -= dt * 1000
      if (this.flickerTimer <= 0) {
        this.flickerTimer = FLICKER_INTERVAL_MS
        this.flickerLow = Math.random() < FLICKER_CHANCE
      }
      t.mesh.position.copy(this.basePos).add(this.jitter)
      t.mesh.scale.setScalar(1)
      t.setOpacity(this.flickerLow ? GHOST_OPACITY_LO : GHOST_OPACITY_HI)
      t.material.color.copy(f.baseColor)
      this.dirty = true
      return
    }
    if (this.isRebirthActive(f.sinceRebirthMs)) {
      this.saveBase(t)
      const k = f.sinceRebirthMs / REBIRTH_MS                   // 0->1
      const step = Math.min(REBIRTH_STEPS - 1, Math.floor(k * REBIRTH_STEPS))
      const level = REBIRTH_OPACITY_FROM + (1 - REBIRTH_OPACITY_FROM) * (step / (REBIRTH_STEPS - 1))
      // Offset decays to zero along with the opacity steps.
      t.mesh.position.copy(this.basePos).addScaledVector(this.jitter, 1 - k)
      t.setOpacity(level)
      t.material.color.copy(f.baseColor)
      this.dirty = true
      return
    }
    if (this.dirty) {                       // first frame outside phases -- restore neutral
      t.mesh.position.copy(this.basePos)
      t.mesh.visible = f.visible
      t.setOpacity(1)
      this.dirty = false
      this.baseSaved = false
    }
  }

  /** "Tear" -- the very start of the ghost (ghost remainder close to 1): first BREAK_MS of the full phase. */
  private isBreakPhase(ghost: number): boolean {
    return ghost > 1 - BREAK_MS / RESPAWN_GHOST_MS
  }

  private saveBase(t: RespawnTarget) {
    if (this.baseSaved) return
    this.basePos.copy(t.mesh.position)
    this.baseSaved = true
  }

  isRebirthActive(sinceRebirthMs: number): boolean {
    return sinceRebirthMs >= 0 && sinceRebirthMs < REBIRTH_MS
  }

  update(_dt: number): void {}
  dispose(): void { this.ghostTrail.dispose() }
}
