import { describe, it, expect } from 'vitest'
import { rollMute } from '../../src/radio/music/radio/engines/muteStyle'
import { createRng } from '../../src/radio/music/seededRandom'

describe('rollMute', () => {
  it('deterministic per seed', () => {
    expect(rollMute(createRng('a'))).toEqual(rollMute(createRng('a')))
  })
  it('gain pattern (when present) is 16 numeric tokens', () => {
    for (let i = 0; i < 60; i++) {
      const m = rollMute(createRng('s' + i))
      if (m.gain) {
        expect(m.gain.split(' ').length).toBe(16)
        expect(/^[0-9.\s]+$/.test(m.gain)).toBe(true)
      }
    }
  })
  it('some tracks have no mute, some do', () => {
    let none = 0, some = 0
    for (let i = 0; i < 100; i++) { if (rollMute(createRng('k' + i)).gain) some++; else none++ }
    expect(none).toBeGreaterThan(0)
    expect(some).toBeGreaterThan(0)
  })
  it('a muted track targets ≥1 layer; a no-mute track targets none', () => {
    for (let i = 0; i < 80; i++) {
      const m = rollMute(createRng('t' + i))
      if (m.gain) expect(m.lead || m.bass || m.drums).toBe(true)
      else expect(m.lead || m.bass || m.drums).toBe(false)
    }
  })
})
