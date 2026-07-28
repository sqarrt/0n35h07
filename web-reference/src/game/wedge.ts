import * as THREE from 'three'

/**
 * Wedge (half-cube ramp) — a triangular prism in the unit cube [-0.5,0.5]³, dir=0 (slope along +Z:
 * low at −Z, high at +Z). Rotation by dir is set externally (rotationY). The mesh is scaled to the
 * required size; for the collider the vertices are scaled (the collider does not inherit the mesh scale).
 *
 * Cross-section in the (z,y) plane: a right triangle A(−z,−y) → B(+z,−y) → C(+z,+y), extruded along X.
 */

// 6 prism vertices (two sides along X), unit cube.
const A0: [number, number, number] = [-0.5, -0.5, -0.5]
const B0: [number, number, number] = [-0.5, -0.5, 0.5]
const C0: [number, number, number] = [-0.5, 0.5, 0.5]
const A1: [number, number, number] = [0.5, -0.5, -0.5]
const B1: [number, number, number] = [0.5, -0.5, 0.5]
const C1: [number, number, number] = [0.5, 0.5, 0.5]

const TRIS: [number, number, number][][] = [
  // bottom (y=-0.5)
  [A0, A1, B1], [A0, B1, B0],
  // back wall (z=+0.5)
  [B1, C1, C0], [B1, C0, B0],
  // slope (hypotenuse A→C)
  [A0, C0, C1], [A0, C1, A1],
  // side triangles (x=±0.5)
  [A0, B0, C0],
  [A1, C1, B1],
]

/** Unit wedge geometry (dir=0); scaled by the mesh. flip — mirror along Y (slope underneath, like a canopy). */
export function unitWedgeGeometry(flip = false): THREE.BufferGeometry {
  const pos: number[] = []
  for (const t of TRIS) {
    // When mirroring along Y, reverse the vertex order — otherwise normals point inward.
    const tri = flip ? [t[0], t[2], t[1]] : t
    for (const v of tri) pos.push(v[0], flip ? -v[1] : v[1], v[2])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Wedge rotation around Y by the dir side (0=+Z,1=+X,2=−Z,3=−X). */
export function wedgeRotationY(dir: number): number {
  return -dir * (Math.PI / 2)
}

const _yAxis = new THREE.Vector3(0, 1, 0)
const _zAxis = new THREE.Vector3(0, 0, 1)
const _yaw = new THREE.Quaternion()
const _roll = new THREE.Quaternion()

/** Ориентация клина. side=false — чистый yaw по dir (как раньше). side=true (диагональная стена) —
 *  roll 90° вокруг Z (ось выдавливания X→вертикаль), затем yaw по dir. */
export function wedgeQuaternion(dir: number, side: boolean, out = new THREE.Quaternion()): THREE.Quaternion {
  _yaw.setFromAxisAngle(_yAxis, wedgeRotationY(dir))
  if (!side) return out.copy(_yaw)
  _roll.setFromAxisAngle(_zAxis, Math.PI / 2)
  return out.copy(_yaw).multiply(_roll)   // сначала roll, затем yaw
}
