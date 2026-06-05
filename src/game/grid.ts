import { BufferGeometry, Float32BufferAttribute } from 'three'

/**
 * Сетка пола с шагом step по размеру арены [hx,hz] — ровные квадратные ячейки (линии по кратным step),
 * подогнанная под прямоугольный пол (без масштабирования, которое перекашивает gridHelper).
 */
export function gridGeometry(hx: number, hz: number, step = 1): BufferGeometry {
  const pos: number[] = []
  for (let x = -hx; x <= hx + 1e-6; x += step) pos.push(x, 0, -hz, x, 0, hz)
  for (let z = -hz; z <= hz + 1e-6; z += step) pos.push(-hx, 0, z, hx, 0, z)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  return g
}
