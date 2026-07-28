import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { SfxProvider } from '../../src/sfx/SfxContext'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import { I18nProvider } from '../../src/i18n'
import { en } from '../../src/i18n/locales/en'

// steamFriendsList is async-polled inside the modal; mock it (hoisted so vi.mock can see it).
const { listMock } = vi.hoisted(() => ({
  listMock: vi.fn(async () => [
    { id: '1', name: 'Alpha', online: true },
    { id: '2', name: 'Bravo', online: true },
    { id: '3', name: 'Charlie', online: false },   // offline → must not appear
  ]),
}))
vi.mock('../../src/steam/steam', () => ({ steamFriendsList: listMock }))

import { SteamFriendPicker } from '../../src/components/lobby/SteamFriendPicker'

function renderPicker(props: Partial<Parameters<typeof SteamFriendPicker>[0]> = {}) {
  const onPick = vi.fn()
  const onClose = vi.fn()
  render(
    <I18nProvider initial="en">
      <SfxProvider engine={new FakeSfxEngine()}>
        <SteamFriendPicker open forming={false} onPick={onPick} onClose={onClose} {...props} />
      </SfxProvider>
    </I18nProvider>,
  )
  return { onPick, onClose }
}

describe('SteamFriendPicker', () => {
  it('lists only ONLINE friends with a count', async () => {
    renderPicker()
    expect(await screen.findByTestId('lobby-friend-1')).toBeTruthy()   // Alpha
    expect(screen.getByTestId('lobby-friend-2')).toBeTruthy()          // Bravo
    expect(screen.queryByTestId('lobby-friend-3')).toBeNull()          // Charlie offline
    expect(screen.getByText((_t, el) => el?.textContent === `${en.lobbyFriendsOnline} · 2`)).toBeTruthy()
  })

  it('search filters the list by name', async () => {
    renderPicker()
    await screen.findByTestId('lobby-friend-1')
    fireEvent.change(screen.getByTestId('lobby-picker-search'), { target: { value: 'bra' } })
    expect(screen.queryByTestId('lobby-friend-1')).toBeNull()   // Alpha filtered out
    expect(screen.getByTestId('lobby-friend-2')).toBeTruthy()   // Bravo matches
  })

  it('picking a friend reports its id and name', async () => {
    const { onPick } = renderPicker()
    fireEvent.click(await screen.findByTestId('lobby-friend-1'))
    expect(onPick).toHaveBeenCalledWith('1', 'Alpha')
  })

  it('forming → "preparing lobby" note instead of the list', () => {
    renderPicker({ forming: true })
    expect(screen.getByText(en.lobbyPreparingLobby)).toBeTruthy()
    expect(screen.queryByTestId('lobby-friend-1')).toBeNull()
  })

  it('closes on ✕ and on backdrop click', async () => {
    const { onClose } = renderPicker()
    fireEvent.click(screen.getByTestId('lobby-picker-close'))
    fireEvent.click(screen.getByTestId('lobby-friend-picker'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders nothing when closed', () => {
    renderPicker({ open: false })
    expect(screen.queryByTestId('lobby-friend-picker')).toBeNull()
  })
})
