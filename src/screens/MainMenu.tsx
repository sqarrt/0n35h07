import { Button } from '../ui/Button'
import { IS_ELECTRON } from '../platform'
import { useT } from '../i18n'

interface MainMenuProps {
  onPlay: () => void
  onAppearance: () => void
  onSettings: () => void
  onExit: () => void
}

// Кнопки главного меню — единая ширина (половина подложки), тексты разной длины их не разъезжают.
const MENU_BUTTON_WIDTH = '50%'

export function MainMenu({ onPlay, onAppearance, onSettings, onExit }: MainMenuProps) {
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
        ONESHOT
      </h1>
      <div className="accent-rule" style={{ marginBottom: '2rem' }} />
      <Button variant="primary" style={btn} onClick={onPlay} data-testid="menu-play">{t.menuPlay}</Button>
      <Button variant="secondary" style={btn} onClick={onAppearance} data-testid="menu-appearance">{t.menuAppearance}</Button>
      <Button variant="secondary" style={btn} onClick={onSettings} data-testid="menu-settings">{t.menuSettings}</Button>
      {/* Выход — только в Electron: в браузере window.close() для обычной вкладки запрещён политикой. */}
      {IS_ELECTRON && <Button variant="ghost" style={btn} onClick={onExit} data-testid="menu-exit">{t.menuExit}</Button>}
    </div>
  )
}
