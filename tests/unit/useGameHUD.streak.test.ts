import { describe, it, expect } from 'vitest'
import { hudReducer, initialHUD } from '../../src/hooks/useGameHUD'

describe('useGameHUD · streaks', () => {
  it('SET_STREAK ставит тир по id, null — снимает', () => {
    let s = hudReducer(initialHUD, { type: 'SET_STREAK', id: 1, tier: 'double' })
    expect(s.streaks[1]).toBe('double')
    s = hudReducer(s, { type: 'SET_STREAK', id: 1, tier: null })
    expect(s.streaks[1]).toBeNull()
  })
  it('RESET_MATCH очищает streaks', () => {
    let s = hudReducer(initialHUD, { type: 'SET_STREAK', id: 0, tier: 'singularity' })
    s = hudReducer(s, { type: 'RESET_MATCH' })
    expect(s.streaks).toEqual({})
  })
})
