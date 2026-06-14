import { describe, it, expect } from 'vitest'
import { SFX_LIBRARY } from '../../src/game/audio/sfx/sfxLibrary'

describe('SFX_LIBRARY', () => {
  it('содержит все 25 событий с url', () => {
    const ids = Object.keys(SFX_LIBRARY).sort()
    expect(ids).toContain('beam_fire')
    expect(ids).toContain('beam_fire_rage')
    expect(ids).toContain('beam_fire_singularity')
    expect(ids).toContain('shield_loop')
    expect(ids).toContain('count_tick')
    expect(ids).toContain('go')
    expect(ids).toContain('catalyst')
    expect(ids).toContain('double_kill')
    expect(ids).toContain('triple_kill')
    expect(ids).toContain('singularity')
    expect(ids.length).toBe(25)
    for (const url of Object.values(SFX_LIBRARY)) expect(typeof url).toBe('string')
  })
})
