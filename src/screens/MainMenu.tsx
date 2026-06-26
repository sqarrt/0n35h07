import { Button } from '../ui/Button'
import { IS_DESKTOP } from '../platform'
import { useT } from '../i18n'

interface MainMenuProps {
  onPlay: () => void
  onAppearance: () => void
  onSettings: () => void
  onAbout: () => void
  onRadio: () => void
  onExit: () => void
}

// Main-menu buttons share one width (half the panel), so texts of different lengths don't shift them.
const MENU_BUTTON_WIDTH = '50%'

export function MainMenu({ onPlay, onAppearance, onSettings, onAbout, onRadio, onExit }: MainMenuProps) {
  const t = useT()
  const btn = { width: MENU_BUTTON_WIDTH } as const
  return (
    <div className="panel-fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{
        fontSize: '4rem', fontWeight: 'bold',
        letterSpacing: '0.3em', color: 'var(--accent)',
        margin: '0 0 1rem', marginLeft: '0.3em',
        textShadow: '0 0 30px rgba(68,170,255,0.5)',
      }}>
        0N35H07
      </h1>
      <div className="accent-rule" style={{ marginBottom: '2rem' }} />
      <Button variant="primary" style={btn} onClick={onPlay} data-testid="menu-play">{t.menuPlay}</Button>
      <Button variant="secondary" style={btn} onClick={onAppearance} data-testid="menu-appearance">{t.menuAppearance}</Button>
      <Button variant="secondary" style={btn} onClick={onSettings} data-testid="menu-settings">{t.menuSettings}</Button>
      <Button variant="secondary" style={btn} onClick={onAbout} data-testid="menu-about">{t.settingsSecAbout}</Button>
      {/* Radio — generative music mode (localized "Radio" word). */}
      <Button variant="secondary" style={btn} onClick={onRadio} data-testid="menu-radio">{t.settingsVolRadio}</Button>
      {/* Exit — desktop only: in the browser window.close() is forbidden by policy for a regular tab. */}
      {IS_DESKTOP && <Button variant="ghost" style={btn} onClick={onExit} data-testid="menu-exit">{t.menuExit}</Button>}
      {/* F11 hint — browser only (desktop is fullscreen already). F11 is a native browser hotkey,
          no handler needed, just the text. */}
      {!IS_DESKTOP && <p className="menu-hint">{t.menuFullscreenHint}</p>}
    </div>
  )
}
