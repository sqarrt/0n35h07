import { describe, it, expect } from 'vitest'
import { AudioAnalysis } from '../../src/game/audio/AudioAnalysis'

describe('AudioAnalysis.level', () => {
  it('пусто → 0', () => {
    expect(new AudioAnalysis().level()).toBe(0)
  })

  it('максимум по источникам', () => {
    const a = new AudioAnalysis()
    a.addReader(() => 0.2)
    a.addReader(() => 0.7)
    a.addReader(() => 0.1)
    expect(a.level()).toBeCloseTo(0.7, 5)
  })

  it('клампится в [0,1]', () => {
    const a = new AudioAnalysis()
    a.addReader(() => 5)
    expect(a.level()).toBe(1)
    const b = new AudioAnalysis()
    b.addReader(() => -3)
    expect(b.level()).toBe(0)
  })

  it('отписка убирает источник', () => {
    const a = new AudioAnalysis()
    const off = a.addReader(() => 0.9)
    expect(a.level()).toBeCloseTo(0.9, 5)
    off()
    expect(a.level()).toBe(0)
  })
})
