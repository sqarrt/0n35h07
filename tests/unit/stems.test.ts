import { describe, it, expect } from 'vitest'
import { STEM_LIBRARY } from '../../src/game/audio/stems'
import { ROLES } from '../../src/game/audio/types'

describe('STEM_LIBRARY', () => {
  it('содержит все 4 роли непустыми', () => {
    for (const role of ROLES) {
      expect(STEM_LIBRARY[role].length).toBeGreaterThan(0)
    }
  })
  it('id стемов в формате role/name и уникальны', () => {
    const ids = ROLES.flatMap(r => STEM_LIBRARY[r].map(s => s.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(STEM_LIBRARY.bass.every(s => s.id.startsWith('bass/'))).toBe(true)
  })
  it('у каждого стема есть url', () => {
    expect(STEM_LIBRARY.kicks.every(s => typeof s.url === 'string' && s.url.length > 0)).toBe(true)
  })
})
