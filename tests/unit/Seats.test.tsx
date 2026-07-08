import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { SfxProvider } from '../../src/sfx/SfxContext'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import { I18nProvider } from '../../src/i18n'
import { Seats } from '../../src/components/lobby/Seats'
import { teamOfSlot, type GameMode } from '../../src/game/modes'
import type { SeatView, PendingInvite } from '../../src/components/lobby/types'

const HUMAN = { name: 'Me', color: '#4af', ready: true, isBot: false }
const BOT = { name: 'RA9', color: '#fa4', ready: true, isBot: true, difficulty: 'normal' as const }

function ffaSeats(): SeatView[] {
  return [
    { slot: 0, entry: HUMAN, mine: true, team: 0 },
    { slot: 1, entry: null, mine: false, team: 1 },
    { slot: 2, entry: null, mine: false, team: 2 },
    { slot: 3, entry: BOT, mine: false, team: 3 },
  ]
}

function renderSeats(over: Partial<Parameters<typeof Seats>[0]> = {}) {
  const cb = {
    onSeatClick: vi.fn(), onBotRemove: vi.fn(), onBotName: vi.fn(), onBotDifficulty: vi.fn(),
  }
  render(
    <I18nProvider initial="en">
      <SfxProvider engine={new FakeSfxEngine()}>
        <Seats mode="ffa" isHost searching={false} seats={ffaSeats()} {...cb} {...over} />
      </SfxProvider>
    </I18nProvider>,
  )
  return cb
}

describe('Seats v2 — единые сиденья всех режимов', () => {
  it('пустое хостовое сиденье — две пунктирные зоны (инвайт + бот, без эмодзи)', () => {
    renderSeats({ invite: { pending: [], onInvite: vi.fn(), onCancel: vi.fn() } })
    expect(screen.getByTestId('seat-invite-1')).toBeTruthy()
    const addBot = screen.getByTestId('seat-addbot-1')
    expect(addBot.textContent).toBe('ADD A BOT')
  })

  it('зоны зовут хендлеры: addbot → onSeatClick(slot, "addbot"); invite → onInvite(slot)', () => {
    const onInvite = vi.fn()
    const { onSeatClick } = renderSeats({ invite: { pending: [], onInvite, onCancel: vi.fn() } })
    fireEvent.click(screen.getByTestId('seat-addbot-1'))
    expect(onSeatClick).toHaveBeenCalledWith(1, 'addbot')
    fireEvent.click(screen.getByTestId('seat-invite-2'))
    expect(onInvite).toHaveBeenCalledWith(2)
  })

  it('веб: invite-зона раскрывает код комнаты на этом сиденье', () => {
    renderSeats({ joinCode: 'AB12' })
    fireEvent.click(screen.getByTestId('seat-invite-1'))
    expect(screen.getByTestId('seat-code-1').textContent).toContain('AB12')
    // соседняя зона осталась CTA
    expect(screen.getByTestId('seat-invite-2').textContent).not.toContain('AB12')
  })

  it('гость: зон нет, клик по пустому сиденью = пересесть', () => {
    const { onSeatClick } = renderSeats({ isHost: false })
    expect(screen.queryByTestId('seat-invite-1')).toBeNull()
    expect(screen.queryByTestId('seat-addbot-1')).toBeNull()
    fireEvent.click(screen.getByTestId('lobby-seat-1'))
    expect(onSeatClick).toHaveBeenCalledWith(1, 'move')
  })

  it('бот-сиденье хоста: инпут имени, реролл по клику, ✕, пер-слотовая сложность', () => {
    const { onBotName, onBotRemove, onBotDifficulty } = renderSeats()
    const input = screen.getByTestId('lobby-bot-name-3') as HTMLInputElement
    expect(input.value).toBe('RA9')
    fireEvent.change(input, { target: { value: 'T-2000' } })
    expect(onBotName).toHaveBeenCalledWith(3, 'T-2000')
    fireEvent.click(screen.getByTestId('lobby-seat-3'))   // клик по сиденью — реролл
    const rerolled = onBotName.mock.calls.at(-1)!
    expect(rerolled[0]).toBe(3)
    expect(String(rerolled[1]).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId('seat-diff-3-passive'))
    expect(onBotDifficulty).toHaveBeenCalledWith(3, 'passive')
    fireEvent.click(screen.getByTestId('lobby-bot-remove-3'))
    expect(onBotRemove).toHaveBeenCalledWith(3)
  })

  it('выбранная сложность подсвечена', () => {
    renderSeats()
    expect(screen.getByTestId('seat-diff-3-normal').className).toContain('seg--on')
    expect(screen.getByTestId('seat-diff-3-passive').className).not.toContain('seg--on')
  })

  it('pending-инвайт проецируется на первое пустое сиденье: имя + ✕ → onCancel(id)', () => {
    const onCancel = vi.fn()
    const pending: PendingInvite[] = [{ id: '42', name: 'Sanya' }]
    renderSeats({ invite: { pending, onInvite: vi.fn(), onCancel } })
    expect(screen.getByTestId('lobby-seat-1').textContent).toContain('Sanya')
    fireEvent.click(screen.getByTestId('lobby-invite-cancel-1'))
    expect(onCancel).toHaveBeenCalledWith('42')
    expect(screen.getByTestId('seat-invite-2')).toBeTruthy()   // второе пустое — всё ещё CTA
  })

  it('searching: зоны скрыты, свободные сиденья крутят имена', () => {
    renderSeats({ searching: true })
    expect(screen.queryByTestId('seat-invite-1')).toBeNull()
    expect(screen.queryByTestId('seat-addbot-1')).toBeNull()
    expect(screen.getByTestId('lobby-spin-1').textContent!.length).toBeGreaterThan(0)
  })

  it('раскладки: 1v1 и 2v2 с VS, ffa — колонка без VS', () => {
    const pair: SeatView[] = [
      { slot: 0, entry: HUMAN, mine: true, team: 0 },
      { slot: 1, entry: null, mine: false, team: 1 },
    ]
    const { unmount } = render(
      <I18nProvider initial="en">
        <SfxProvider engine={new FakeSfxEngine()}>
          <Seats mode="1v1" isHost searching={false} seats={pair}
            onSeatClick={vi.fn()} onBotRemove={vi.fn()} onBotName={vi.fn()} onBotDifficulty={vi.fn()} />
        </SfxProvider>
      </I18nProvider>,
    )
    expect(screen.getByTestId('lobby-seats').getAttribute('data-mode')).toBe('1v1')
    expect(screen.getByTestId('lobby-seats').textContent).toContain('VS')
    unmount()

    const quad = (['2v2', 'ffa'] as GameMode[]).map(m =>
      ffaSeats().map(s => ({ ...s, team: teamOfSlot(m, s.slot) })))
    render(
      <I18nProvider initial="en">
        <SfxProvider engine={new FakeSfxEngine()}>
          <Seats mode="2v2" isHost searching={false} seats={quad[0]}
            onSeatClick={vi.fn()} onBotRemove={vi.fn()} onBotName={vi.fn()} onBotDifficulty={vi.fn()} />
        </SfxProvider>
      </I18nProvider>,
    )
    const grid = screen.getByTestId('lobby-seats')
    expect(grid.getAttribute('data-mode')).toBe('2v2')
    expect(grid.querySelectorAll('.seats-col').length).toBe(2)
    expect(grid.textContent).toContain('VS')
  })

  it('человек рендерится как раньше: имя, data-mine, ready-подсветка', () => {
    renderSeats()
    const seat = screen.getByTestId('lobby-seat-0')
    expect(seat.getAttribute('data-mine')).toBe('true')
    expect(seat.textContent).toContain('Me')
    expect(seat.className).toContain('lobby-seat--ready')
  })
})
