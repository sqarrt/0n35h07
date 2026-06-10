import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { Appearance } from '../../src/screens/Appearance'
import { SfxProvider } from '../../src/sfx/SfxContext'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import type { PlayerProfile } from '../../src/settings'

const profile: PlayerProfile = {
  name: 'Тест', primaryColor: '#4af', reserveColor: '#fa4', defaultView: 'fp',
  ballModel: 'smooth', windupStyle: 'classic', postProcessing: true, showFps: false, showSpeed: false,
  menuGlow: true, audioViz: true, volumeMaster: 1, volumeMusic: 0.3, volumeSfx: 1, volumeMenuMusic: 0.3,
  connectTimeoutSec: 10,
}

function renderAppearance(onShotPreview = vi.fn(), onPreview = vi.fn()) {
  render(
    <SfxProvider engine={new FakeSfxEngine()}>
      <Appearance profile={profile} onChange={() => {}} onPreview={onPreview} onShotPreview={onShotPreview} onBack={() => {}} />
    </SfxProvider>,
  )
  return { onShotPreview, onPreview }
}

describe('Appearance — триггер превью выстрела', () => {
  it('монтирование НЕ дёргает onShotPreview (вход без клика не проигрывает превью)', () => {
    const { onShotPreview } = renderAppearance()
    fireEvent.click(screen.getByRole('button', { name: 'ВЫСТРЕЛ' }))   // открыть подвкладку — тоже не триггер
    expect(onShotPreview).not.toHaveBeenCalled()
  })

  it('каждый клик по стилю (включая повторный по тому же) дёргает onShotPreview', () => {
    const { onShotPreview } = renderAppearance()
    fireEvent.click(screen.getByRole('button', { name: 'ВЫСТРЕЛ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ЯРОСТЬ' }))
    expect(onShotPreview).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'ЯРОСТЬ' }))    // повторный клик — повтор превью
    expect(onShotPreview).toHaveBeenCalledTimes(2)
  })

  it('onPreview больше НЕ несёт счётчик (им владеет App): 5 аргументов — цвет/модель/кольцо/стиль/подвкладка', () => {
    const { onPreview } = renderAppearance()
    const last = onPreview.mock.calls.at(-1)!
    expect(last.length).toBe(5)
    expect(last[4]).toBe('color')   // активная подвкладка
  })
})
