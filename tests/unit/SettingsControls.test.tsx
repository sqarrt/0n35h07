import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { I18nProvider } from '../../src/i18n'
import { SfxProvider } from '../../src/sfx/SfxContext'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import { en } from '../../src/i18n/locales/en'
import type { ReactNode } from 'react'

// Stub the persistence side-effect; keep the rest of settings real (loadProfile for a valid shape).
const { saveProfileMock } = vi.hoisted(() => ({ saveProfileMock: vi.fn() }))
vi.mock('../../src/settings', async (orig) => ({ ...(await orig<typeof import('../../src/settings')>()), saveProfile: saveProfileMock }))

import { loadProfile } from '../../src/settings'
import { SoundControls, GraphicsControls } from '../../src/components/SettingsControls'

const wrap = (ui: ReactNode) =>
  render(<I18nProvider initial="en"><SfxProvider engine={new FakeSfxEngine()}>{ui}</SfxProvider></I18nProvider>)

beforeEach(() => saveProfileMock.mockClear())

describe('SettingsControls', () => {
  it('GraphicsControls (inMatch) shows only the match-relevant toggles', () => {
    wrap(<GraphicsControls profile={loadProfile()} onChange={vi.fn()} inMatch />)
    expect(screen.getByTestId('settings-toggle-outline')).toBeTruthy()
    expect(screen.getByTestId('settings-toggle-fps')).toBeTruthy()
    expect(screen.getByTestId('settings-toggle-speed')).toBeTruthy()
    // menu-only toggles hidden in a match
    expect(screen.queryByTestId('settings-toggle-menu-glow')).toBeNull()
    expect(screen.queryByTestId('settings-toggle-audio-viz')).toBeNull()
  })

  it('GraphicsControls (full) shows the menu-only toggles too', () => {
    wrap(<GraphicsControls profile={loadProfile()} onChange={vi.fn()} />)
    expect(screen.getByTestId('settings-toggle-menu-glow')).toBeTruthy()
    expect(screen.getByTestId('settings-toggle-audio-viz')).toBeTruthy()
  })

  it('toggling a switch flips the field and persists (onChange + saveProfile)', () => {
    const onChange = vi.fn()
    const base = { ...loadProfile(), showFps: false }
    wrap(<GraphicsControls profile={base} onChange={onChange} inMatch />)
    fireEvent.click(screen.getByTestId('settings-toggle-fps'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showFps: true }))
    expect(saveProfileMock).toHaveBeenCalledWith(expect.objectContaining({ showFps: true }))
  })

  it('SoundControls renders the four volume sliders', () => {
    wrap(<SoundControls profile={loadProfile()} onChange={vi.fn()} />)
    for (const lbl of [en.settingsVolMaster, en.settingsVolMusic, en.settingsVolMenuMusic, en.settingsVolSfx]) {
      expect(screen.getByText(lbl)).toBeTruthy()
    }
  })
})
