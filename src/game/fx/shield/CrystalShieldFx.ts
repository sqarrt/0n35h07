import * as THREE from 'three'
import type { IShieldFx } from './types'

// CRYSTAL: faceted icosahedron shell — translucent fill, edges, and faces that flash
// one at a time (rate-limited switching — photosensitivity).
const CRYSTAL_COLOR        = '#4af'
const CRYSTAL_RADIUS       = 0.78
const CRYSTAL_FILL_OPACITY = 0.12
const CRYSTAL_EDGE_OPACITY = 0.5
const CRYSTAL_FACE_OPACITY = 0.4    // opacity of the flashing face
const CRYSTAL_FLICKER_MS   = 140    // lit-face switch period (~7 Hz)
const CRYSTAL_FACE_SCALE   = 1.01   // face slightly above the shell (anti z-fighting)
const FLOATS_PER_FACE      = 9      // 3 vertices x 3 coordinates in non-indexed geometry
const FACE_STEP            = 7      // coprime with 20 → visits all faces out of order

export class CrystalShieldFx implements IShieldFx {
  readonly object3d = new THREE.Group()
  private shellGeo: THREE.IcosahedronGeometry
  private edgesGeo: THREE.EdgesGeometry
  private faceGeos: THREE.BufferGeometry[] = []
  private fillMat: THREE.MeshBasicMaterial
  private edgeMat: THREE.LineBasicMaterial
  private faceMat: THREE.MeshBasicMaterial
  private faces: THREE.Mesh[] = []
  private clock = 0   // ms since creation — drives the current flashing face

  constructor() {
    this.shellGeo = new THREE.IcosahedronGeometry(CRYSTAL_RADIUS, 0)
    this.fillMat = new THREE.MeshBasicMaterial({
      color: CRYSTAL_COLOR, transparent: true, opacity: CRYSTAL_FILL_OPACITY,
      side: THREE.DoubleSide, depthWrite: false,
    })
    const shell = new THREE.Mesh(this.shellGeo, this.fillMat)
    shell.userData.noRaycast = true

    this.edgesGeo = new THREE.EdgesGeometry(this.shellGeo)
    this.edgeMat = new THREE.LineBasicMaterial({
      color: CRYSTAL_COLOR, transparent: true, opacity: CRYSTAL_EDGE_OPACITY, depthWrite: false,
    })
    const edges = new THREE.LineSegments(this.edgesGeo, this.edgeMat)
    edges.userData.noRaycast = true
    this.object3d.add(shell, edges)

    // Flash faces: one triangle per icosahedron face, one visible at a time.
    this.faceMat = new THREE.MeshBasicMaterial({
      color: CRYSTAL_COLOR, transparent: true, opacity: CRYSTAL_FACE_OPACITY,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    const pos = this.shellGeo.getAttribute('position')   // non-indexed: 3 vertices per face
    const faceCount = pos.count / 3
    for (let f = 0; f < faceCount; f++) {
      const geo = new THREE.BufferGeometry()
      const verts = (pos.array as Float32Array).slice(f * FLOATS_PER_FACE, (f + 1) * FLOATS_PER_FACE)
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
      const face = new THREE.Mesh(geo, this.faceMat)
      face.scale.setScalar(CRYSTAL_FACE_SCALE)
      face.visible = false
      face.userData.noRaycast = true
      this.object3d.add(face)
      this.faceGeos.push(geo)
      this.faces.push(face)
    }
  }

  update(dt: number, active: boolean) {
    if (!active) return
    this.clock += dt * 1000
    const lit = (Math.floor(this.clock / CRYSTAL_FLICKER_MS) * FACE_STEP) % this.faces.length
    this.faces.forEach((face, i) => { face.visible = i === lit })
  }

  dispose() {
    this.shellGeo.dispose()
    this.edgesGeo.dispose()
    this.faceGeos.forEach(g => g.dispose())
    this.fillMat.dispose()
    this.edgeMat.dispose()
    this.faceMat.dispose()
  }
}
