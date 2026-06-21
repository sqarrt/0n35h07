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

/** Prism vertices scaled to the block's full size (for ConvexHullCollider; dir — via rotation). */
export function wedgeColliderPoints(size: [number, number, number], flip = false): number[] {
  const [hx, hy, hz] = size
  const pts = [A0, B0, C0, A1, B1, C1]
  const out: number[] = []
  for (const p of pts) out.push(p[0] * 2 * hx, (flip ? -p[1] : p[1]) * 2 * hy, p[2] * 2 * hz)
  return out
}

/** Wedge rotation around Y by the dir side (0=+Z,1=+X,2=−Z,3=−X). */
export function wedgeRotationY(dir: number): number {
  return -dir * (Math.PI / 2)
}
