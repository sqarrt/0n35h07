import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { SfxProvider } from '../../src/sfx/SfxContext'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import { I18nProvider } from '../../src/i18n'
import { ModeCarousel } from '../../src/components/lobby/ModeCarousel'
import type { GameMode } from '../../src/game/modes'

function renderCarousel(mode: GameMode = '1v1', enabled = true) {
  const onSetMode = vi.fn()
  render(
    <I18nProvider initial="en">
      <SfxProvider engine={new FakeSfxEngine()}>
        <ModeCarousel mode={mode} enabled={enabled} onSetMode={onSetMode} />
      </SfxProvider>
    </I18nProvider>,
  )
  return { onSetMode }
}

describe('ModeCarousel — карусель режимов Duel/Battle/War', () => {
  it('выбранный режим в центре, соседи по циклу слева/справа', () => {
    renderCarousel('1v1')
    expect(screen.getByTestId('mode-tile-1v1').getAttribute('data-role')).toBe('center')
    expect(screen.getByTestId('mode-tile-2v2').getAttribute('data-role')).toBe('right')
    expect(screen.getByTestId('mode-tile-ffa').getAttribute('data-role')).toBe('left')
  })

  it('плитка показывает только имя режима — без подзаголовка и стрелок', () => {
    renderCarousel('ffa')
    const tile = screen.getByTestId('mode-tile-ffa')
    expect(tile.textContent).toBe('War')
    expect(tile.getAttribute('data-role')).toBe('center')
    expect(screen.queryByTestId('mode-prev')).toBeNull()
    expect(screen.queryByTestId('mode-next')).toBeNull()
  })

  it('клик по соседней плитке выбирает её; клик по центру — no-op', () => {
    const { onSetMode } = renderCarousel('1v1')
    fireEvent.click(screen.getByTestId('mode-tile-2v2'))
    expect(onSetMode).toHaveBeenCalledWith('2v2')
    fireEvent.click(screen.getByTestId('mode-tile-1v1'))
    expect(onSetMode).toHaveBeenCalledTimes(1)
  })

  it('обе соседние плитки кликабельны: левая и правая выбирают свой режим', () => {
    const { onSetMode } = renderCarousel('1v1')
    fireEvent.click(screen.getByTestId('mode-tile-ffa'))
    expect(onSetMode).toHaveBeenLastCalledWith('ffa')
    fireEvent.click(screen.getByTestId('mode-tile-2v2'))
    expect(onSetMode).toHaveBeenLastCalledWith('2v2')
  })

  it('заблокированная карусель (гость/поиск) не зовёт onSetMode', () => {
    const { onSetMode } = renderCarousel('1v1', false)
    fireEvent.click(screen.getByTestId('mode-tile-2v2'))
    fireEvent.click(screen.getByTestId('mode-tile-ffa'))
    expect(onSetMode).not.toHaveBeenCalled()
  })
})
