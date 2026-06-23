import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { SteamInvitePanel } from '../../src/components/lobby/SteamInvitePanel'
import { SfxProvider } from '../../src/sfx/SfxContext'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import { I18nProvider } from '../../src/i18n'
import { en } from '../../src/i18n/locales/en'

function renderPanel(props: Partial<Parameters<typeof SteamInvitePanel>[0]> = {}) {
  const onInviteOverlay = vi.fn()
  const onInviteFriend = vi.fn()
  render(
    <I18nProvider initial="en">
      <SfxProvider engine={new FakeSfxEngine()}>
        <SteamInvitePanel forming={false} disabled={false} onInviteOverlay={onInviteOverlay} onInviteFriend={onInviteFriend} {...props} />
      </SfxProvider>
    </I18nProvider>,
  )
  return { onInviteOverlay, onInviteFriend }
}

describe('SteamInvitePanel', () => {
  it('shows the two invite paths; overlay button fires its callback', () => {
    const { onInviteOverlay } = renderPanel()
    expect(screen.getByText(en.lobbyInviteSection)).toBeTruthy()
    fireEvent.click(screen.getByTestId('lobby-invite-overlay'))
    expect(onInviteOverlay).toHaveBeenCalledOnce()
  })

  it('off-Steam (no friends) → "no friends online" note', () => {
    renderPanel()
    expect(screen.getByText(en.lobbyNoFriends)).toBeTruthy()
  })

  it('forming → "preparing lobby" note (same fixed-height container)', () => {
    renderPanel({ forming: true })
    expect(screen.getByText(en.lobbyPreparingLobby)).toBeTruthy()
  })

  it('disabled → dims in place (lobby-steam--off, kept mounted)', () => {
    renderPanel({ disabled: true })
    const panel = screen.getByTestId('lobby-steam-invite')
    expect(panel.className).toContain('lobby-steam--off')
    expect(panel.getAttribute('aria-disabled')).toBe('true')
  })
})
