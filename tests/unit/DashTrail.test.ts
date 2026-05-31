import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { AfterimageTrail } from '../../src/game/fx/AfterimageTrail'
import { DASH_TRAIL_GHOST_LIFE } from '../../src/constants'

const POS = new THREE.Vector3(0, 1.7, 0)
const DT = 0.016

function run(t: AfterimageTrail, dashing: boolean, frames: number) {
  for (let i = 0; i < frames; i++) t.update(DT, { position: POS, dashing })
}

// След рывка — чистая визуальная логика (THREE без WebGL), тестируем в jsdom.
describe('AfterimageTrail', () => {
  it('во время рывка спавнит клоны, в покое — нет', () => {
    const t = new AfterimageTrail(new THREE.Color('#4af'))
    expect(t.aliveCount).toBe(0)
    run(t, true, 8)
    expect(t.aliveCount).toBeGreaterThan(0)
  })

  it('после рывка клоны затухают до нуля', () => {
    const t = new AfterimageTrail(new THREE.Color('#4af'))
    run(t, true, 8)
    expect(t.aliveCount).toBeGreaterThan(0)
    const frames = Math.ceil(DASH_TRAIL_GHOST_LIFE / 1000 / DT) + 2
    run(t, false, frames)
    expect(t.aliveCount).toBe(0)
  })

  it('пул не переполняется — aliveCount ограничен размером пула', () => {
    const t = new AfterimageTrail(new THREE.Color('#4af'))
    run(t, true, 200)
    expect(t.aliveCount).toBeLessThanOrEqual(10)   // DASH_TRAIL_GHOST_COUNT
  })
})
