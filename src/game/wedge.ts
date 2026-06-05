import * as THREE from 'three'

/**
 * Клин (полукуб-рампа) — треугольная призма в единичном кубе [-0.5,0.5]³, dir=0 (скос вдоль +Z:
 * низ у −Z, верх у +Z). Поворот по dir задаётся снаружи (rotationY). Меш масштабируется до нужного
 * размера; для коллайдера вершины масштабируем (collider не наследует scale меша).
 *
 * Сечение в плоскости (z,y): прямоугольный треугольник A(−z,−y) → B(+z,−y) → C(+z,+y), вытянут по X.
 */

// 6 вершин призмы (две стороны по X), единичный куб.
const A0: [number, number, number] = [-0.5, -0.5, -0.5]
const B0: [number, number, number] = [-0.5, -0.5, 0.5]
const C0: [number, number, number] = [-0.5, 0.5, 0.5]
const A1: [number, number, number] = [0.5, -0.5, -0.5]
const B1: [number, number, number] = [0.5, -0.5, 0.5]
const C1: [number, number, number] = [0.5, 0.5, 0.5]

const TRIS: [number, number, number][][] = [
  // низ (y=-0.5)
  [A0, A1, B1], [A0, B1, B0],
  // задняя стенка (z=+0.5)
  [B1, C1, C0], [B1, C0, B0],
  // скос (гипотенуза A→C)
  [A0, C0, C1], [A0, C1, A1],
  // боковые треугольники (x=±0.5)
  [A0, B0, C0],
  [A1, C1, B1],
]

/** Единичная геометрия клина (dir=0); масштабируется мешем. flip — перевернуть по Y (скос снизу, как навес). */
export function unitWedgeGeometry(flip = false): THREE.BufferGeometry {
  const pos: number[] = []
  for (const t of TRIS) {
    // При зеркале по Y разворачиваем порядок вершин — иначе нормали смотрят внутрь.
    const tri = flip ? [t[0], t[2], t[1]] : t
    for (const v of tri) pos.push(v[0], flip ? -v[1] : v[1], v[2])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Вершины призмы, масштабированные под полный размер блока (для ConvexHullCollider; dir — через rotation). */
export function wedgeColliderPoints(size: [number, number, number], flip = false): number[] {
  const [hx, hy, hz] = size
  const pts = [A0, B0, C0, A1, B1, C1]
  const out: number[] = []
  for (const p of pts) out.push(p[0] * 2 * hx, (flip ? -p[1] : p[1]) * 2 * hy, p[2] * 2 * hz)
  return out
}

/** Поворот клина вокруг Y по стороне dir (0=+Z,1=+X,2=−Z,3=−X). */
export function wedgeRotationY(dir: number): number {
  return -dir * (Math.PI / 2)
}
