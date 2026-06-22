import { describe, it, expect } from 'vitest'
import { screenStatusToken } from '../../src/steam/richPresence'

describe('screenStatusToken', () => {
  it('lobby → InLobby, game → InMatch', () => {
    expect(screenStatusToken('lobby')).toBe('#Status_InLobby')
    expect(screenStatusToken('game')).toBe('#Status_InMatch')
  })
  it('menu and all other non-match screens → InMenu', () => {
    for (const s of ['menu', 'settings', 'appearance', 'trailer'] as const) {
      expect(screenStatusToken(s)).toBe('#Status_InMenu')
    }
  })
})
