import * as THREE from 'three'
import { BALL_RADIUS } from '../../../constants'
import type { IWindupFx, WindupTarget, WindupFrame } from './types'

// --- Ball: slight swell + darkening to a "charred" look with a pulsing red glow. ---
const RAGE_SCALE_GAIN = 0.25          // scale gain at peak (less than default — it's not the size that scares)
const RAGE_BODY_DARK = '#1a0505'      // "charred" body color at peak charge
const RAGE_EMISSIVE = '#ff2200'       // red-hot glow color
const RAGE_PULSE_HZ_MIN = 1.5         // glow pulse frequency at charge start
const RAGE_PULSE_HZ_MAX = 6           // and at peak (capped — photosensitivity)
const RAGE_PULSE_DEPTH = 0.45         // glow oscillation depth (brightness swings 0.55..1.0)

// --- Jaws: two arcs of triangular teeth — a "hologram" in front of the player. ---
const JAW_TEETH = 6                   // teeth per jaw (even → symmetric row, no central tooth)
const JAW_WIDTH = BALL_RADIUS * 4.7   // arc span (bigger than the ball, but doesn't overpower the model)
const JAW_TOOTH_LEN = BALL_RADIUS * 1.5
const JAW_TOOTH_LEN_VAR = 0.35        // tooth length variation (fraction), deterministic by index
const JAW_TOOTH_W = JAW_WIDTH / JAW_TEETH * 0.85   // tooth base width (with gap between teeth)
const JAW_ARCH = BALL_RADIUS * 0.75   // vertical arc bow (center higher than edges)
const JAW_CURVE = BALL_RADIUS * 1.2   // horseshoe curve in depth (arc center pushed along aim)
const JAW_EDGE_YAW = 0.6              // yaw of edge teeth along the arc (radians)
const JAW_GAP = BALL_RADIUS * 0.33    // base gap between jaws (closed mouth)
const JAW_DISTANCE = BALL_RADIUS * 1.8  // how far in front of the ball the projection hangs (close, but not inside)
const JAW_OPEN_DIST = BALL_RADIUS * 2.8   // jaw travel at full open (wide maw)
const JAW_OPEN_RAD = 0.85             // extra spread via rotation (radians)
const JAW_OPACITY = 0.4               // base hologram opacity
const JAW_COLOR = '#e8f4ff'           // cold white-blue "screen"
const JAW_APPEAR_FRAC = 0.15          // fraction of charge over which the projection fades in
const JAW_SNAP_FRAC = 0.3             // fraction of the deflate phase over which the mouth snaps shut
// Glitch: rare projection jerks (offset + opacity dip). Frequency capped (photosensitivity).
const GLITCH_INTERVAL_MS = 160        // minimum interval between jerks (≤ ~6 Hz)
const GLITCH_CHANCE = 0.45            // jerk probability per interval
const GLITCH_DURATION_MS = 70
const GLITCH_SHIFT = BALL_RADIUS * 0.25
const GLITCH_OPACITY_DROP = 0.55      // opacity multiplier during a jerk

/** Deterministic pseudo-randomness by tooth index (ragged outline without Math.random in geometry). */
const toothVar = (i: number) => 1 - JAW_TOOTH_LEN_VAR * (0.5 + 0.5 * Math.sin(i * 12.9898))

/** Arc of triangular teeth. up=true — upper jaw (teeth point down). The row is curved into a horseshoe:
 *  central teeth pushed forward along aim, edge teeth set back and turned outward (like a mouth). */
function buildJaw(up: boolean, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  for (let i = 0; i < JAW_TEETH; i++) {
    const t = i / (JAW_TEETH - 1)                                  // 0..1 along the arc
    const bow = 1 - (2 * t - 1) ** 2                               // parabola: 1 at center, 0 at edges
    const arch = JAW_ARCH * bow                                    // center higher than edges
    const len = JAW_TOOTH_LEN * toothVar(i + (up ? 0 : 3))         // lower jaw has its own pattern
    const dir = up ? -1 : 1
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      -JAW_TOOTH_W / 2, 0, 0,
       JAW_TOOTH_W / 2, 0, 0,
       0, dir * len, 0,
    ], 3))
    const tooth = new THREE.Mesh(geo, mat)
    // Horseshoe: arc center pushed forward (+Z local — along aim), edges trail behind.
    tooth.position.set((t - 0.5) * JAW_WIDTH, (JAW_GAP / 2 + arch) * (up ? 1 : -1), JAW_CURVE * bow)
    tooth.rotation.y = -(2 * t - 1) * JAW_EDGE_YAW                 // edge teeth turned along the arc
    tooth.userData.noRaycast = true
    g.add(tooth)
  }
  return g
}

/**
 * "Zorn's Rage" (Remember Me): the ball glows white-hot from within, and a giant glitching
 * hologram of human jaws opens in front of the player as it charges; the mouth snaps shut on fire.
 */
export class RageWindupFx implements IWindupFx {
  readonly object3d = new THREE.Group()
  private upper: THREE.Group
  private lower: THREE.Group
  private mat: THREE.MeshBasicMaterial
  private bodyDark = new THREE.Color(RAGE_BODY_DARK)
  private emissive = new THREE.Color(RAGE_EMISSIVE)
  private time = 0                 // local time (glow pulse)
  private glitchTimer = 0          // remaining time of the current jerk, ms
  // Init cooldown to the full interval: the first coin flip happens only after GLITCH_INTERVAL_MS.
  // This guarantees no glitch is applied on the first frame (deterministic position test).
  private glitchCooldown = GLITCH_INTERVAL_MS
  private glitchOffset = new THREE.Vector3()
  private forward = new THREE.Vector3()
  private lookTarget = new THREE.Vector3()

  constructor() {
    this.mat = new THREE.MeshBasicMaterial({
      color: JAW_COLOR, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
    this.upper = buildJaw(true, this.mat)
    this.lower = buildJaw(false, this.mat)
    this.object3d.add(this.upper, this.lower)
    this.object3d.visible = false
  }

  apply(dt: number, t: WindupTarget, f: WindupFrame): void {
    this.time += dt
    if (f.progress > 0) {
      t.mesh.scale.setScalar(1 + f.progress * RAGE_SCALE_GAIN)
      t.material.color.lerpColors(f.baseColor, this.bodyDark, f.progress)
      const hz = RAGE_PULSE_HZ_MIN + (RAGE_PULSE_HZ_MAX - RAGE_PULSE_HZ_MIN) * f.progress
      const pulse = 1 - RAGE_PULSE_DEPTH * (0.5 + 0.5 * Math.sin(this.time * hz * 2 * Math.PI))
      t.material.emissive.copy(this.emissive).multiplyScalar(f.progress * pulse)
    } else if (f.shrink < 1) {
      t.mesh.scale.setScalar(1 + RAGE_SCALE_GAIN * (1 - f.shrink))
      t.material.color.copy(f.baseColor)
      t.material.emissive.copy(this.emissive).multiplyScalar(1 - f.shrink)   // glow fades out
    } else {
      t.mesh.scale.setScalar(1)
      t.material.color.copy(f.baseColor)
      t.material.emissive.setScalar(0)
    }
    this.applyJaws(dt, f)
  }

  private applyJaws(dt: number, f: WindupFrame) {
    const active = f.progress > 0 || f.shrink < 1
    this.object3d.visible = active && f.visible
    if (!this.object3d.visible) return

    // The projection hangs in front of the player along the horizontal projection of the aim.
    this.forward.copy(f.aimDir).setY(0)
    if (this.forward.lengthSq() < 1e-8) this.forward.set(0, 0, -1)
    this.forward.normalize()
    this.object3d.position.copy(f.origin).addScaledVector(this.forward, JAW_DISTANCE)
    // lookAt expects a WORLD point: in the preview the parent (ball group) is shifted and scaled,
    // so build the target from the world position (direction is undistorted by unrotated parents).
    // Invariant: object3d parents must have no rotation (shift and uniform scale are allowed).
    this.object3d.getWorldPosition(this.lookTarget).add(this.forward)
    this.object3d.lookAt(this.lookTarget)

    // Opening: grows with charge; after firing the mouth SNAPS SHUT over JAW_SNAP_FRAC of the deflate phase.
    const open = f.progress > 0 ? f.progress : Math.max(0, 1 - f.shrink / JAW_SNAP_FRAC)
    this.upper.position.y = open * JAW_OPEN_DIST
    this.lower.position.y = -open * JAW_OPEN_DIST
    this.upper.rotation.x = -open * JAW_OPEN_RAD
    this.lower.rotation.x = open * JAW_OPEN_RAD

    // Opacity: fade-in at charge start; dissolve after firing.
    const appear = f.progress > 0 ? Math.min(f.progress / JAW_APPEAR_FRAC, 1) : 1 - f.shrink

    // Glitch: capped jerk frequency (see constants).
    const ms = dt * 1000
    this.glitchTimer = Math.max(0, this.glitchTimer - ms)
    this.glitchCooldown -= ms
    if (this.glitchCooldown <= 0) {
      this.glitchCooldown = GLITCH_INTERVAL_MS
      if (Math.random() < GLITCH_CHANCE) {
        this.glitchTimer = GLITCH_DURATION_MS
        this.glitchOffset.set((Math.random() - 0.5) * 2 * GLITCH_SHIFT, (Math.random() - 0.5) * GLITCH_SHIFT, 0)
      }
    }
    const glitching = this.glitchTimer > 0
    if (glitching) this.object3d.position.add(this.glitchOffset)
    this.mat.opacity = JAW_OPACITY * appear * (glitching ? GLITCH_OPACITY_DROP : 1)
  }

  dispose(): void {
    for (const g of [this.upper, this.lower]) g.children.forEach(c => (c as THREE.Mesh).geometry.dispose())
    this.mat.dispose()
  }
}
