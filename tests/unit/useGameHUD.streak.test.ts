import { describe, it, expect } from 'vitest'
import { hudReducer, initialHUD } from '../../src/hooks/useGameHUD'

describe('useGameHUD · streaks', () => {
  it('SET_STREAK sets tier by id, null clears it', () => {
    let s = hudReducer(initialHUD, { type: 'SET_STREAK', id: 1, tier: 'double', count: 2 })
    expect(s.streaks[1]).toBe('double')
    s = hudReducer(s, { type: 'SET_STREAK', id: 1, tier: null, count: 0 })
    expect(s.streaks[1]).toBeNull()
  })
  it('RESET_MATCH clears streaks', () => {
    let s = hudReducer(initialHUD, { type: 'SET_STREAK', id: 0, tier: 'singularity', count: 5 })
    s = hudReducer(s, { type: 'RESET_MATCH' })
    expect(s.streaks).toEqual({})
  })
  it('SET_STREAK keeps the streak counter (for dots)', () => {
    const s = hudReducer(initialHUD, { type: 'SET_STREAK', id: 1, tier: 'triple', count: 4 })
    expect(s.streakCounts[1]).toBe(4)
  })
  it('RESET_MATCH clears streakCounts', () => {
    let s = hudReducer(initialHUD, { type: 'SET_STREAK', id: 0, tier: 'double', count: 2 })
    s = hudReducer(s, { type: 'RESET_MATCH' })
    expect(s.streakCounts).toEqual({})
  })
})
