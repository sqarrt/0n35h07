import { describe, it, expect } from 'vitest'
import { SFX_LIBRARY } from '../../src/game/audio/sfx/sfxLibrary'

describe('SFX_LIBRARY', () => {
  it('содержит все 18 событий с url', () => {
    const ids = Object.keys(SFX_LIBRARY).sort()
    expect(ids).toContain('beam_fire')
    expect(ids).toContain('shield_loop')
    expect(ids).toContain('count_tick')
    expect(ids).toContain('go')
    expect(ids.length).toBe(19)
    for (const url of Object.values(SFX_LIBRARY)) expect(typeof url).toBe('string')
  })
})
