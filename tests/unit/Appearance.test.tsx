import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { Appearance } from '../../src/screens/Appearance'
import { SfxProvider } from '../../src/sfx/SfxContext'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import { I18nProvider } from '../../src/i18n'
import { en } from '../../src/i18n/locales/en'
import type { PlayerProfile } from '../../src/settings'

const profile: PlayerProfile = {
  name: 'Test', primaryColor: '#4af', reserveColor: '#fa4', defaultView: 'fp',
  ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo', dashStyle: 'streak', shieldStyle: 'dome',
  postProcessing: true, showFps: false, showSpeed: false,
  menuGlow: true, audioViz: true, volumeMaster: 1, volumeMusic: 0.3, volumeSfx: 1, volumeMenuMusic: 0.3,
  connectTimeoutSec: 10,
}

function renderAppearance(onShotPreview = vi.fn(), onPreview = vi.fn(), onRespawnPreview = vi.fn(), onDashPreview = vi.fn(), onShieldPreview = vi.fn()) {
  render(
    <I18nProvider initial="en">
      <SfxProvider engine={new FakeSfxEngine()}>
        <Appearance profile={profile} onChange={() => {}} onPreview={onPreview}
          onShotPreview={onShotPreview} onRespawnPreview={onRespawnPreview}
          onDashPreview={onDashPreview} onShieldPreview={onShieldPreview} onBack={() => {}} />
      </SfxProvider>
    </I18nProvider>,
  )
  return { onShotPreview, onPreview, onRespawnPreview, onDashPreview, onShieldPreview }
}

describe('Appearance — flat screen', () => {
  it('all blocks visible without sub-tabs; PULSE label instead of DEFAULT', () => {
    renderAppearance()
    expect(screen.getByText(en.appearPrimaryColor)).toBeTruthy()
    expect(screen.getByText(en.appearModel)).toBeTruthy()
    expect(screen.getByText(en.appearShotAnim)).toBeTruthy()
    expect(screen.getByText(en.appearRespawnAnim)).toBeTruthy()
    expect(screen.getByText(en.appearDashTrail)).toBeTruthy()
    expect(screen.getByText(en.appearShield)).toBeTruthy()
    expect(screen.getByRole('button', { name: en.styleWindupClassic })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.styleDashStreak })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.styleShieldDome })).toBeTruthy()
    expect(screen.queryByText('DEFAULT')).toBeNull()
  })

  it('mounting does NOT trigger preview callbacks (entry without click is silent)', () => {
    const { onShotPreview, onRespawnPreview, onDashPreview, onShieldPreview } = renderAppearance()
    expect(onShotPreview).not.toHaveBeenCalled()
    expect(onRespawnPreview).not.toHaveBeenCalled()
    expect(onDashPreview).not.toHaveBeenCalled()
    expect(onShieldPreview).not.toHaveBeenCalled()
  })

  it('every click on a shot style (including repeats) fires onShotPreview WITH the style', () => {
    const { onShotPreview } = renderAppearance()
    fireEvent.click(screen.getByRole('button', { name: en.styleWindupRage }))
    expect(onShotPreview).toHaveBeenCalledTimes(1)
    expect(onShotPreview).toHaveBeenLastCalledWith('rage')
    fireEvent.click(screen.getByRole('button', { name: en.styleWindupRage }))    // repeat click — preview replays
    expect(onShotPreview).toHaveBeenCalledTimes(2)
  })

  it('every click on a respawn style fires onRespawnPreview(style); repeat — again', () => {
    const { onRespawnPreview } = renderAppearance()
    fireEvent.click(screen.getByRole('button', { name: en.styleRespawnChaos }))
    expect(onRespawnPreview).toHaveBeenLastCalledWith('chaos')
    fireEvent.click(screen.getByRole('button', { name: en.styleRespawnChaos }))
    expect(onRespawnPreview).toHaveBeenCalledTimes(2)
  })

  it('every click on a dash skin fires onDashPreview(style); repeat — again', () => {
    const { onDashPreview } = renderAppearance()
    fireEvent.click(screen.getByRole('button', { name: en.styleDashWave }))
    expect(onDashPreview).toHaveBeenLastCalledWith('wave')
    fireEvent.click(screen.getByRole('button', { name: en.styleDashWave }))
    expect(onDashPreview).toHaveBeenCalledTimes(2)
  })

  it('every click on a shield skin fires onShieldPreview(style); repeat — again', () => {
    const { onShieldPreview } = renderAppearance()
    fireEvent.click(screen.getByRole('button', { name: en.styleShieldHex }))
    expect(onShieldPreview).toHaveBeenLastCalledWith('hex')
    fireEvent.click(screen.getByRole('button', { name: en.styleShieldHex }))
    expect(onShieldPreview).toHaveBeenCalledTimes(2)
  })

  it('part in onPreview follows the last click (color → shot → respawn → dash → shield → model)', () => {
    const { onPreview } = renderAppearance()
    const lastPart = () => onPreview.mock.calls.at(-1)![7]   // part — 8th argument (ballArt follows it)
    expect(lastPart()).toBe('color')                              // initial part — like COLOR
    fireEvent.click(screen.getByRole('button', { name: en.styleWindupClassic }))
    expect(lastPart()).toBe('shot')
    fireEvent.click(screen.getByRole('button', { name: en.styleRespawnEcho }))
    expect(lastPart()).toBe('respawn')
    fireEvent.click(screen.getByRole('button', { name: en.styleDashRift }))
    expect(lastPart()).toBe('dash')
    fireEvent.click(screen.getByRole('button', { name: en.styleShieldCrystal }))
    expect(lastPart()).toBe('shield')
    fireEvent.click(screen.getByRole('button', { name: en.styleModelWaves }))
    expect(lastPart()).toBe('model')
  })

  it('onPreview carries all styles (9 args: color/model/ring/shot/respawn/dash/shield/block/art)', () => {
    const { onPreview } = renderAppearance()
    const last = onPreview.mock.calls.at(-1)!
    expect(last.length).toBe(9)
    expect(last[3]).toBe('classic')   // windupStyle
    expect(last[4]).toBe('echo')      // respawnStyle
    expect(last[5]).toBe('streak')    // dashStyle
    expect(last[6]).toBe('dome')      // shieldStyle
    expect(last[8]).toBeUndefined()   // ballArt — empty by default
  })

  it('painting the front field saves ballArt to the profile and into the preview', () => {
    const onChange = vi.fn()
    const onPreview = vi.fn()
    render(
      <I18nProvider initial="en">
        <SfxProvider engine={new FakeSfxEngine()}>
          <Appearance profile={profile} onChange={onChange} onPreview={onPreview}
            onShotPreview={vi.fn()} onRespawnPreview={vi.fn()} onDashPreview={vi.fn()}
            onShieldPreview={vi.fn()} onBack={() => {}} />
        </SfxProvider>
      </I18nProvider>,
    )
    const canvas = screen.getByTestId('paint-front') as HTMLCanvasElement
    canvas.setPointerCapture = () => {}   // jsdom does not implement pointer capture
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 132, height: 132, right: 132, bottom: 132, x: 0, y: 0, toJSON: () => {} }) as DOMRect
    fireEvent.pointerDown(canvas, { clientX: 66, clientY: 66, pointerId: 1 })   // field center — inside the disc
    const saved = onChange.mock.calls.at(-1)![0]
    expect(typeof saved.ballArt).toBe('string')
    expect(saved.ballArt.length).toBe(88)
    expect(onPreview.mock.calls.at(-1)![8]).toBe(saved.ballArt)   // preview got the same art
  })
})
