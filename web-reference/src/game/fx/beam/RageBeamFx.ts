import * as THREE from 'three'
import { BEAM_DURATION } from '../../../constants'
import type { IBeamFx } from './types'

// "Ragged discharge": a segmented beam with glitch jitter (in the spirit of rage's jaws).
const SEGMENTS = 7               // shell segments along the shot line
const CORE_RADIUS = 0.04         // solid white core (thinner than the default)
const SEG_RADIUS = 0.16          // shell segment radius
const SEG_OPACITY = 0.7
const SEG_LEN_FRAC = 0.8         // segment length as a fraction of the step — gaps read as "breaks"
const JITTER_MAX = 0.22          // max lateral segment offset (world units)
const JITTER_INTERVAL_MS = 90    // jitter swap rate (capped — photosensitivity)
const PULSE_HZ = 9               // thickness pulse
const PULSE_DEPTH = 0.2          // pulse depth (±20%)
const CYL_SEGMENTS = 6
// Ragged fade: opacity steps over the beam's lifetime (instead of a smooth shrink) — discharge "dropouts".
const FADE_STEPS: { until: number; level: number }[] = [
  { until: 0.45, level: 1 },
  { until: 0.6,  level: 0.35 },
  { until: 0.75, level: 0.8 },
  { until: 0.9,  level: 0.25 },
  { until: 1,    level: 0.1 },
]
const UP = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)

/** Rage-style beam: white core + ragged player-colored segments rattling sideways, stepped fade. */
export class RageBeamFx implements IBeamFx {
  readonly object3d = new THREE.Group()
  private core: THREE.Mesh
  private coreMat: THREE.MeshBasicMaterial
  private segs: THREE.Mesh[] = []
  private segMat: THREE.MeshBasicMaterial
  private offsets: THREE.Vector2[] = []   // lateral segment offsets in the (side1, side2) basis

  private active = false
  private elapsed = 0          // ms since the shot
  private jitterTimer = 0      // ms until the next jitter swap
  private time = 0             // local time (thickness pulse)
  private start = new THREE.Vector3()
  private end = new THREE.Vector3()
  private quat = new THREE.Quaternion()   // cylinder orientation along the beam
  private dirN = new THREE.Vector3()
  private side1 = new THREE.Vector3()
  private side2 = new THREE.Vector3()
  private scratch = new THREE.Vector3()
  private len = 0

  constructor(playerColor: string) {
    this.coreMat = new THREE.MeshBasicMaterial({
      color: 'white', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    this.core = new THREE.Mesh(new THREE.CylinderGeometry(CORE_RADIUS, CORE_RADIUS, 1, CYL_SEGMENTS), this.coreMat)
    this.core.userData.noRaycast = true
    this.core.visible = false
    this.segMat = new THREE.MeshBasicMaterial({
      color: playerColor, transparent: true, opacity: SEG_OPACITY, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    for (let i = 0; i < SEGMENTS; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(SEG_RADIUS, SEG_RADIUS, 1, CYL_SEGMENTS), this.segMat)
      seg.userData.noRaycast = true
      seg.visible = false
      this.segs.push(seg)
      this.offsets.push(new THREE.Vector2())
    }
    this.object3d.add(this.core, ...this.segs)
  }

  play(start: THREE.Vector3, end: THREE.Vector3): void {
    this.start.copy(start)
    this.end.copy(end)
    this.dirN.copy(end).sub(start)
    this.len = this.dirN.length()
    if (this.len < 1e-6) return
    this.dirN.divideScalar(this.len)
    this.quat.setFromUnitVectors(UP, this.dirN)
    // Lateral basis: for a vertical beam dir×UP degenerates → fall back to X.
    this.side1.crossVectors(this.dirN, UP)
    if (this.side1.lengthSq() < 1e-8) this.side1.copy(X_AXIS)
    this.side1.normalize()
    this.side2.crossVectors(this.dirN, this.side1).normalize()
    this.active = true
    this.elapsed = 0
    this.jitterTimer = 0   // the very first frame rolls jitter
  }

  private rollJitter() {
    for (const o of this.offsets) {
      o.set((Math.random() - 0.5) * 2 * JITTER_MAX, (Math.random() - 0.5) * 2 * JITTER_MAX)
    }
  }

  update(dt: number): void {
    this.time += dt
    if (!this.active) return
    this.elapsed += dt * 1000
    const t = this.elapsed / BEAM_DURATION
    if (t >= 1) { this.hide(); return }

    this.jitterTimer -= dt * 1000
    if (this.jitterTimer <= 0) { this.jitterTimer = JITTER_INTERVAL_MS; this.rollJitter() }

    const level = (FADE_STEPS.find(s => t < s.until) ?? FADE_STEPS[FADE_STEPS.length - 1]).level
    const pulse = 1 + PULSE_DEPTH * Math.sin(this.time * PULSE_HZ * 2 * Math.PI)
    this.coreMat.opacity = level
    this.segMat.opacity = SEG_OPACITY * level

    // Core — solid, along the whole line.
    this.core.position.copy(this.start).lerp(this.end, 0.5)
    this.core.quaternion.copy(this.quat)
    this.core.scale.set(pulse, this.len, pulse)
    this.core.visible = true

    // Shell segments — along the line with lateral rattle.
    const segLen = (this.len / SEGMENTS) * SEG_LEN_FRAC
    for (let i = 0; i < SEGMENTS; i++) {
      const seg = this.segs[i]
      const off = this.offsets[i]
      this.scratch.copy(this.start).lerp(this.end, (i + 0.5) / SEGMENTS)
        .addScaledVector(this.side1, off.x)
        .addScaledVector(this.side2, off.y)
      seg.position.copy(this.scratch)
      seg.quaternion.copy(this.quat)
      seg.scale.set(pulse, segLen, pulse)
      seg.visible = true
    }
  }

  private hide() {
    this.active = false
    this.core.visible = false
    for (const s of this.segs) s.visible = false
  }

  reset(): void { this.hide() }

  dispose(): void {
    this.core.geometry.dispose()
    this.coreMat.dispose()
    this.segs.forEach(s => s.geometry.dispose())
    this.segMat.dispose()
  }
}
