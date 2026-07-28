import * as THREE from 'three'

export interface SpriteEmitOptions {
  position: THREE.Vector3
  life:     number   // ms
  opacity:  number   // starting opacity
}

interface Sprite {
  mesh:        THREE.Mesh
  mat:         THREE.MeshBasicMaterial
  life:        number   // remaining life, ms
  maxLife:     number
  baseOpacity: number
}

/**
 * Pool of fading additive sprites for the dash trail. Owns its geometry/meshes;
 * emit grabs a free sprite, update fades opacity and shrinks by life.
 */
export class SpritePool {
  readonly object3d = new THREE.Group()
  private geometry: THREE.SphereGeometry
  private sprites: Sprite[] = []

  constructor(color: THREE.Color, count: number, radius: number) {
    this.geometry = new THREE.SphereGeometry(radius, 8, 8)
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const mesh = new THREE.Mesh(this.geometry, mat)
      mesh.visible = false
      mesh.userData.noRaycast = true
      this.object3d.add(mesh)
      this.sprites.push({ mesh, mat, life: 0, maxLife: 1, baseOpacity: 0 })
    }
  }

  emit(o: SpriteEmitOptions) {
    const s = this.sprites.find(sp => sp.life <= 0)
    if (!s) return   // pool exhausted — skip (minor visual detail)
    s.mesh.position.copy(o.position)
    s.life = o.life
    s.maxLife = o.life
    s.baseOpacity = o.opacity
    s.mesh.visible = true
    s.mesh.scale.setScalar(1)
    s.mat.opacity = o.opacity
  }

  update(dt: number) {
    const ms = dt * 1000
    for (const s of this.sprites) {
      if (s.life <= 0) continue
      s.life -= ms
      if (s.life <= 0) { s.mesh.visible = false; s.mat.opacity = 0; continue }
      const t = s.life / s.maxLife   // 1 → 0
      s.mat.opacity = s.baseOpacity * t
      s.mesh.scale.setScalar(t)      // shrinks toward end of life
    }
  }

  get aliveCount() { return this.sprites.reduce((n, s) => n + (s.life > 0 ? 1 : 0), 0) }

  dispose() {
    this.geometry.dispose()
    this.sprites.forEach(s => s.mat.dispose())
  }
}
