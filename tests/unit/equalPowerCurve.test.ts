import { describe, it, expect } from 'vitest'
import { equalPowerCurve } from '../../src/game/audio/WebAudioMusicEngine'

// Анти-щелчок: КАЖДАЯ кривая гейна должна стартовать с нуля, иначе свежий источник,
// начинающий играть с ненулевого buffer[0] на полном гейне, даёт разрыв сигнала = щелчок.
describe('equalPowerCurve — края начинаются/кончаются нулём (де-клик)', () => {
  it('in: 0 → gain', () => {
    const c = equalPowerCurve(0.8, 'in')
    expect(c[0]).toBe(0)
    expect(c[c.length - 1]).toBeCloseTo(0.8, 5)
  })

  it('out: 0 (де-клик старта свежего хвоста) → 0', () => {
    const c = equalPowerCurve(0.8, 'out')
    expect(c[0]).toBe(0)                          // не full на buffer[0] — иначе щелчок
    expect(c[c.length - 1]).toBeCloseTo(0, 5)
  })
})
