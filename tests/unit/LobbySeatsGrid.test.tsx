import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { SfxProvider } from '../../src/sfx/SfxContext'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import { I18nProvider } from '../../src/i18n'
import { LobbySeatsGrid } from '../../src/components/lobby/LobbySeatsGrid'
import type { SeatView, PendingInvite } from '../../src/components/lobby/types'

const SEATS: SeatView[] = [
  { slot: 0, entry: { name: 'Me', color: '#4af', ready: true, isBot: false }, mine: true, team: 0 },
  { slot: 1, entry: null, mine: false, team: 1 },
  { slot: 2, entry: null, mine: false, team: 2 },
  { slot: 3, entry: { name: 'Bot', color: '#fa4', ready: true, isBot: true }, mine: false, team: 3 },
]

function renderGrid(over: Partial<Parameters<typeof LobbySeatsGrid>[0]> = {}) {
  const onSeatClick = vi.fn()
  const onBotRemove = vi.fn()
  render(
    <I18nProvider initial="en">
      <SfxProvider engine={new FakeSfxEngine()}>
        <LobbySeatsGrid mode="ffa" isHost seats={SEATS} onSeatClick={onSeatClick} onBotRemove={onBotRemove} {...over} />
      </SfxProvider>
    </I18nProvider>,
  )
  return { onSeatClick, onBotRemove }
}

describe('LobbySeatsGrid — invite-CTA (Steam friend tab)', () => {
  it('без invite-пропа пустое сиденье — глиф — (web-путь не меняется)', () => {
    renderGrid()
    expect(screen.getByTestId('lobby-seat-1').textContent).toBe('—')
    expect(screen.queryByTestId('lobby-seat-bot-1')).toBeNull()
  })

  it('с invite и пустым pending: сиденье показывает CTA и угловую бот-кнопку', () => {
    renderGrid({ invite: { pending: [], onInvite: vi.fn(), onCancel: vi.fn() } })
    expect(screen.getByTestId('lobby-seat-1').textContent).toContain('＋')
    expect(screen.getByTestId('lobby-seat-bot-1')).toBeTruthy()
  })

  it('клик по CTA зовёт onInvite; клик по 🤖 зовёт onSeatClick(slot) и НЕ зовёт onInvite', () => {
    const onInvite = vi.fn()
    const { onSeatClick } = renderGrid({ invite: { pending: [], onInvite, onCancel: vi.fn() } })
    fireEvent.click(screen.getByTestId('lobby-seat-1'))
    expect(onInvite).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByTestId('lobby-seat-bot-2'))
    expect(onSeatClick).toHaveBeenCalledWith(2)
    expect(onInvite).toHaveBeenCalledOnce()   // не выросло
  })

  it('pending-инвайт занимает первое пустое сиденье: имя + ✕ → onCancel(id)', () => {
    const onCancel = vi.fn()
    const pending: PendingInvite[] = [{ id: '42', name: 'Sanya' }]
    renderGrid({ invite: { pending, onInvite: vi.fn(), onCancel } })
    const seat = screen.getByTestId('lobby-seat-1')
    expect(seat.textContent).toContain('Sanya')
    fireEvent.click(screen.getByTestId('lobby-invite-cancel-1'))
    expect(onCancel).toHaveBeenCalledWith('42')
    // второе пустое сиденье осталось CTA
    expect(screen.getByTestId('lobby-seat-2').textContent).toContain('＋')
  })

  it('занятые сиденья рендерятся как раньше (имя, data-mine, ✕ бота)', () => {
    renderGrid({ invite: { pending: [], onInvite: vi.fn(), onCancel: vi.fn() } })
    expect(screen.getByTestId('lobby-seat-0').getAttribute('data-mine')).toBe('true')
    expect(screen.getByTestId('lobby-seat-0').textContent).toContain('Me')
    expect(screen.getByTestId('lobby-bot-remove-3')).toBeTruthy()
  })
})
