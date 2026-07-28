import { describe, it, expect } from 'vitest'
import { DRUM_KITS_SND, kitBankOf } from '../../src/radio/music/radio/engines/drumKit'

describe('drumKit', () => {
  it('ids unique, ≥6 kits', () => {
    expect(new Set(DRUM_KITS_SND.map((k) => k.id)).size).toBe(DRUM_KITS_SND.length)
    expect(DRUM_KITS_SND.length).toBeGreaterThanOrEqual(6)
  })
  it('kitBankOf defaults a drum to the kick bank when unset (coherent kit)', () => {
    expect(kitBankOf({ id: 'x', kickBank: 'RolandTR909', kickN: 0 }, 'snare')).toBe('RolandTR909')
    expect(kitBankOf({ id: 'h', kickBank: 'RolandTR808', kickN: 0, hatBank: 'RolandTR909' }, 'hat')).toBe('RolandTR909')
  })
})
