import * as THREE from 'three'
import type { IShieldFx } from './types'

// КРИСТАЛЛ: гранёная икосаэдр-скорлупа — полупрозрачная заливка, рёбра и поочерёдно
// вспыхивающие грани (одна за раз, смена с ограниченной частотой — фоточувствительность).
const CRYSTAL_COLOR        = '#4af'
const CRYSTAL_RADIUS       = 0.78
const CRYSTAL_FILL_OPACITY = 0.12
const CRYSTAL_EDGE_OPACITY = 0.5
const CRYSTAL_FACE_OPACITY = 0.4    // непрозрачность вспыхнувшей грани
const CRYSTAL_FLICKER_MS   = 140    // период смены подсвеченной грани (~7 Гц)
const CRYSTAL_FACE_SCALE   = 1.01   // грань чуть поверх скорлупы (анти z-fighting)
const FLOATS_PER_FACE      = 9      // 3 вершины × 3 координаты у неиндексированной геометрии
const FACE_STEP            = 7      // взаимно просто с 20 → обход всех граней не по порядку

export class CrystalShieldFx implements IShieldFx {
  readonly object3d = new THREE.Group()
  private shellGeo: THREE.IcosahedronGeometry
  private edgesGeo: THREE.EdgesGeometry
  private faceGeos: THREE.BufferGeometry[] = []
  private fillMat: THREE.MeshBasicMaterial
  private edgeMat: THREE.LineBasicMaterial
  private faceMat: THREE.MeshBasicMaterial
  private faces: THREE.Mesh[] = []
  private clock = 0   // мс с создания — задаёт текущую вспыхнувшую грань

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

    // Грани-вспышки: по треугольнику на каждую грань икосаэдра, видна одна за раз.
    this.faceMat = new THREE.MeshBasicMaterial({
      color: CRYSTAL_COLOR, transparent: true, opacity: CRYSTAL_FACE_OPACITY,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    const pos = this.shellGeo.getAttribute('position')   // неиндексированная: 3 вершины на грань
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
