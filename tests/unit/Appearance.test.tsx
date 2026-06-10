import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { Appearance } from '../../src/screens/Appearance'
import { SfxProvider } from '../../src/sfx/SfxContext'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import type { PlayerProfile } from '../../src/settings'

const profile: PlayerProfile = {
  name: 'Тест', primaryColor: '#4af', reserveColor: '#fa4', defaultView: 'fp',
  ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo', dashStyle: 'streak', shieldStyle: 'dome',
  postProcessing: true, showFps: false, showSpeed: false,
  menuGlow: true, audioViz: true, volumeMaster: 1, volumeMusic: 0.3, volumeSfx: 1, volumeMenuMusic: 0.3,
  connectTimeoutSec: 10,
}

function renderAppearance(onShotPreview = vi.fn(), onPreview = vi.fn(), onRespawnPreview = vi.fn(), onDashPreview = vi.fn(), onShieldPreview = vi.fn()) {
  render(
    <SfxProvider engine={new FakeSfxEngine()}>
      <Appearance profile={profile} onChange={() => {}} onPreview={onPreview}
        onShotPreview={onShotPreview} onRespawnPreview={onRespawnPreview}
        onDashPreview={onDashPreview} onShieldPreview={onShieldPreview} onBack={() => {}} />
    </SfxProvider>,
  )
  return { onShotPreview, onPreview, onRespawnPreview, onDashPreview, onShieldPreview }
}

describe('Appearance — плоский экран', () => {
  it('все блоки видны без подвкладок; лейбл ИМПУЛЬС вместо ДЕФОЛТ', () => {
    renderAppearance()
    expect(screen.getByText('ОСНОВНОЙ ЦВЕТ')).toBeTruthy()
    expect(screen.getByText('МОДЕЛЬ СФЕРЫ')).toBeTruthy()
    expect(screen.getByText('АНИМАЦИЯ ВЫСТРЕЛА')).toBeTruthy()
    expect(screen.getByText('АНИМАЦИЯ РЕСПАВНА')).toBeTruthy()
    expect(screen.getByText('СЛЕД РЫВКА')).toBeTruthy()
    expect(screen.getByText('ЩИТ')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'ИМПУЛЬС' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'ШЛЕЙФ' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'КУПОЛ' })).toBeTruthy()
    expect(screen.queryByText('ДЕФОЛТ')).toBeNull()
  })

  it('монтирование НЕ дёргает триггеры превью (вход без клика тих)', () => {
    const { onShotPreview, onRespawnPreview, onDashPreview, onShieldPreview } = renderAppearance()
    expect(onShotPreview).not.toHaveBeenCalled()
    expect(onRespawnPreview).not.toHaveBeenCalled()
    expect(onDashPreview).not.toHaveBeenCalled()
    expect(onShieldPreview).not.toHaveBeenCalled()
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

  it('каждый клик по скину рывка дёргает onDashPreview(style); повторный — снова', () => {
    const { onDashPreview } = renderAppearance()
    fireEvent.click(screen.getByRole('button', { name: 'ВОЛНА' }))
    expect(onDashPreview).toHaveBeenLastCalledWith('wave')
    fireEvent.click(screen.getByRole('button', { name: 'ВОЛНА' }))
    expect(onDashPreview).toHaveBeenCalledTimes(2)
  })

  it('каждый клик по скину щита дёргает onShieldPreview(style); повторный — снова', () => {
    const { onShieldPreview } = renderAppearance()
    fireEvent.click(screen.getByRole('button', { name: 'СОТЫ' }))
    expect(onShieldPreview).toHaveBeenLastCalledWith('hex')
    fireEvent.click(screen.getByRole('button', { name: 'СОТЫ' }))
    expect(onShieldPreview).toHaveBeenCalledTimes(2)
  })

  it('part в onPreview следует за последним кликом (color → shot → respawn → dash → shield → model)', () => {
    const { onPreview } = renderAppearance()
    const lastPart = () => onPreview.mock.calls.at(-1)!.at(-1)
    expect(lastPart()).toBe('color')                              // начальный part — как ЦВЕТ
    fireEvent.click(screen.getByRole('button', { name: 'ИМПУЛЬС' }))
    expect(lastPart()).toBe('shot')
    fireEvent.click(screen.getByRole('button', { name: 'ЭХО' }))
    expect(lastPart()).toBe('respawn')
    fireEvent.click(screen.getByRole('button', { name: 'РАЗРЫВ' }))
    expect(lastPart()).toBe('dash')
    fireEvent.click(screen.getByRole('button', { name: 'КРИСТАЛЛ' }))
    expect(lastPart()).toBe('shield')
    fireEvent.click(screen.getByRole('button', { name: 'ВОЛНЫ' }))
    expect(lastPart()).toBe('model')
  })

  it('onPreview несёт все стили (8 аргументов: цвет/модель/кольцо/выстрел/респавн/рывок/щит/блок)', () => {
    const { onPreview } = renderAppearance()
    const last = onPreview.mock.calls.at(-1)!
    expect(last.length).toBe(8)
    expect(last[3]).toBe('classic')   // windupStyle
    expect(last[4]).toBe('echo')      // respawnStyle
    expect(last[5]).toBe('streak')    // dashStyle
    expect(last[6]).toBe('dome')      // shieldStyle
  })
})
