import { describe, it, expect } from 'vitest'
import { visibleSections } from '../../src/screens/settingsSections'

describe('visibleSections', () => {
  it('web build shows all tabs including "net"', () => {
    expect(visibleSections(false)).toEqual(['player', 'sound', 'net', 'graphics'])
  })

  it('Steam/desktop build hides the "net" tab', () => {
    const tabs = visibleSections(true)
    expect(tabs).not.toContain('net')
    expect(tabs).toEqual(['player', 'sound', 'graphics'])
  })

  it('drops only "net" — order and other tabs are preserved', () => {
    const web = visibleSections(false)
    const desktop = visibleSections(true)
    expect(desktop).toEqual(web.filter(s => s !== 'net'))
  })
})
