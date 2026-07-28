import { describe, it, expect } from 'vitest'
import { chooseFirstRunName } from '../../src/settings'

describe('chooseFirstRunName', () => {
  it('uses the Steam name on a fresh profile', () => {
    expect(chooseFirstRunName(true, 'CoolGuy', 'MODEL-7')).toBe('CoolGuy')
  })
  it('keeps the fallback when not a first run (existing profile)', () => {
    expect(chooseFirstRunName(false, 'CoolGuy', 'MODEL-7')).toBe('MODEL-7')
  })
  it('keeps the fallback when there is no Steam name', () => {
    expect(chooseFirstRunName(true, null, 'MODEL-7')).toBe('MODEL-7')
    expect(chooseFirstRunName(true, '   ', 'MODEL-7')).toBe('MODEL-7')
  })
  it('trims the Steam name', () => {
    expect(chooseFirstRunName(true, '  Spacey  ', 'MODEL-7')).toBe('Spacey')
  })
})
