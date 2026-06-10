import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { Appearance } from '../../src/screens/Appearance'
import { SfxProvider } from '../../src/sfx/SfxContext'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import type { PlayerProfile } from '../../src/settings'

const profile: PlayerProfile = {
  name: 'Тест', primaryColor: '#4af', reserveColor: '#fa4', defaultView: 'fp',
  ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo',
  postProcessing: true, showFps: false, showSpeed: false,
  menuGlow: true, audioViz: true, volumeMaster: 1, volumeMusic: 0.3, volumeSfx: 1, volumeMenuMusic: 0.3,
  connectTimeoutSec: 10,
}

function renderAppearance(onShotPreview = vi.fn(), onPreview = vi.fn(), onRespawnPreview = vi.fn()) {
  render(
    <SfxProvider engine={new FakeSfxEngine()}>
      <Appearance profile={profile} onChange={() => {}} onPreview={onPreview}
        onShotPreview={onShotPreview} onRespawnPreview={onRespawnPreview} onBack={() => {}} />
    </SfxProvider>,
  )
  return { onShotPreview, onPreview, onRespawnPreview }
}

describe('Appearance — плоский экран', () => {
  it('все блоки видны без подвкладок; лейбл ИМПУЛЬС вместо ДЕФОЛТ', () => {
    renderAppearance()
    expect(screen.getByText('ОСНОВНОЙ ЦВЕТ')).toBeTruthy()
    expect(screen.getByText('МОДЕЛЬ СФЕРЫ')).toBeTruthy()
    expect(screen.getByText('АНИМАЦИЯ ВЫСТРЕЛА')).toBeTruthy()
    expect(screen.getByText('АНИМАЦИЯ РЕСПАВНА')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'ИМПУЛЬС' })).toBeTruthy()
    expect(screen.queryByText('ДЕФОЛТ')).toBeNull()
  })

  it('монтирование НЕ дёргает триггеры превью (вход без клика тих)', () => {
    const { onShotPreview, onRespawnPreview } = renderAppearance()
    expect(onShotPreview).not.toHaveBeenCalled()
    expect(onRespawnPreview).not.toHaveBeenCalled()
  })

  it('каждый клик по стилю выстрела (включая повторный) дёргает onShotPreview СО стилем', () => {
    const { onShotPreview } = renderAppearance()
    fireEvent.click(screen.getByRole('button', { name: 'ЯРОСТЬ' }))
    expect(onShotPreview).toHaveBeenCalledTimes(1)
    expect(onShotPreview).toHaveBeenLastCalledWith('rage')
    fireEvent.click(screen.getByRole('button', { name: 'ЯРОСТЬ' }))    // повторный клик — повтор превью
    expect(onShotPreview).toHaveBeenCalledTimes(2)
  })

  it('каждый клик по стилю респавна дёргает onRespawnPreview(style); повторный — снова', () => {
    const { onRespawnPreview } = renderAppearance()
    fireEvent.click(screen.getByRole('button', { name: 'ХАОС' }))
    expect(onRespawnPreview).toHaveBeenLastCalledWith('chaos')
    fireEvent.click(screen.getByRole('button', { name: 'ХАОС' }))
    expect(onRespawnPreview).toHaveBeenCalledTimes(2)
  })

  it('part в onPreview следует за последним кликом (color → shot → respawn → model)', () => {
    const { onPreview } = renderAppearance()
    const lastPart = () => onPreview.mock.calls.at(-1)!.at(-1)
    expect(lastPart()).toBe('color')                              // начальный part — как ЦВЕТ
    fireEvent.click(screen.getByRole('button', { name: 'ИМПУЛЬС' }))
    expect(lastPart()).toBe('shot')
    fireEvent.click(screen.getByRole('button', { name: 'ЭХО' }))
    expect(lastPart()).toBe('respawn')
    fireEvent.click(screen.getByRole('button', { name: 'ВОЛНЫ' }))
    expect(lastPart()).toBe('model')
  })

  it('onPreview несёт оба стиля (6 аргументов: цвет/модель/кольцо/выстрел/респавн/блок)', () => {
    const { onPreview } = renderAppearance()
    const last = onPreview.mock.calls.at(-1)!
    expect(last.length).toBe(6)
    expect(last[3]).toBe('classic')   // windupStyle
    expect(last[4]).toBe('echo')      // respawnStyle
  })
})
