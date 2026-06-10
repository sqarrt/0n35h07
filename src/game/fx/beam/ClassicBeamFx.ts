import * as THREE from 'three'
import { BEAM_DURATION } from '../../../constants'
import type { IBeamFx } from './types'

// Геометрия и тайминги — перенесены из BeamWeapon как есть (поведение бит-в-бит).
const CORE_RADIUS = 0.05         // белое ядро луча
const SHELL_RADIUS = 0.15        // цветная оболочка
const SHELL_OPACITY = 0.6
const AFTERGLOW_RADIUS = 0.1
const AFTERGLOW_INITIAL = 0.5    // стартовая «энергия» афтерглоу после выстрела
const AFTERGLOW_FADE = 1.8       // скорость её затухания (ед/с)
const AFTERGLOW_OPACITY_K = 0.4  // перевод энергии в непрозрачность
const CYL_SEGMENTS = 8
const UP = new THREE.Vector3(0, 1, 0)

/** Дефолтный луч: белое ядро + цветная оболочка, радиальный шринк за BEAM_DURATION, афтерглоу. */
export class ClassicBeamFx implements IBeamFx {
  readonly object3d = new THREE.Group()
  private beamGroup = new THREE.Group()
  private afterglowMesh: THREE.Mesh
  private mats: THREE.Material[] = []
  private active = false
  private elapsed = 0          // мс с момента выстрела
  private start = new THREE.Vector3()
  private end = new THREE.Vector3()
  private afterglowOpacity = 0
  private beamDuration: number

  constructor(innerColor = 'white', outerColor = '#0ff', beamDuration = BEAM_DURATION) {
    this.beamDuration = beamDuration
    const innerMat = new THREE.MeshBasicMaterial({ color: innerColor })
    const outerMat = new THREE.MeshBasicMaterial({
      color: outerColor, transparent: true, opacity: SHELL_OPACITY,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(CORE_RADIUS, CORE_RADIUS, 1, CYL_SEGMENTS), innerMat)
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(SHELL_RADIUS, SHELL_RADIUS, 1, CYL_SEGMENTS), outerMat)
    inner.userData.noRaycast = true
    outer.userData.noRaycast = true
    this.beamGroup.add(inner, outer)
    this.beamGroup.visible = false

    const aMat = new THREE.MeshBasicMaterial({
      color: outerColor, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    this.afterglowMesh = new THREE.Mesh(new THREE.CylinderGeometry(AFTERGLOW_RADIUS, AFTERGLOW_RADIUS, 1, CYL_SEGMENTS), aMat)
    this.afterglowMesh.userData.noRaycast = true
    this.afterglowMesh.visible = false

    this.object3d.add(this.beamGroup, this.afterglowMesh)
    this.mats.push(innerMat, outerMat, aMat)
  }

  play(start: THREE.Vector3, end: THREE.Vector3): void {
    this.start.copy(start)
    this.end.copy(end)
    this.active = true
    this.elapsed = 0
    this.afterglowOpacity = AFTERGLOW_INITIAL
  }

  update(dt: number): void {
    this.renderBeam(dt * 1000)
    this.renderAfterglow(dt)
  }

  private renderBeam(ms: number) {
    if (!this.active) { this.beamGroup.visible = false; return }
    this.elapsed += ms
    const t = Math.min(this.elapsed / this.beamDuration, 1)
    if (t >= 1) { this.active = false; this.beamGroup.visible = false; return }
    const dir = this.end.clone().sub(this.start)
    const len = dir.length()
    this.beamGroup.position.copy(this.start).lerp(this.end, 0.5)
    this.beamGroup.quaternion.setFromUnitVectors(UP, dir.normalize())
    this.beamGroup.scale.set(1 - t, len, 1 - t)
    this.beamGroup.visible = true
  }

  private renderAfterglow(dt: number) {
    if (this.afterglowOpacity <= 0) { this.afterglowMesh.visible = false; return }
    this.afterglowOpacity -= dt * AFTERGLOW_FADE
    if (this.afterglowOpacity <= 0) { this.afterglowMesh.visible = false; return }
    const dir = this.end.clone().sub(this.start)
    const len = dir.length()
    this.afterglowMesh.position.copy(this.start).lerp(this.end, 0.5)
    this.afterglowMesh.quaternion.setFromUnitVectors(UP, dir.normalize())
    this.afterglowMesh.scale.set(1, len, 1)
    ;(this.afterglowMesh.material as THREE.MeshBasicMaterial).opacity = this.afterglowOpacity * AFTERGLOW_OPACITY_K
    this.afterglowMesh.visible = true
  }

  reset(): void {
    this.active = false
    this.afterglowOpacity = 0
    this.beamGroup.visible = false
    this.afterglowMesh.visible = false
  }

  dispose(): void {
    this.beamGroup.children.forEach(c => (c as THREE.Mesh).geometry.dispose())
    this.afterglowMesh.geometry.dispose()
    this.mats.forEach(m => m.dispose())
  }
}
