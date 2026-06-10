import { Button } from '../ui/Button'
import { IS_ELECTRON } from '../platform'

interface MainMenuProps {
  onCreateRoom: () => void
  onJoinRoom: () => void
  onAppearance: () => void
  onSettings: () => void
  onExit: () => void
}

// Кнопки главного меню — единая ширина (половина подложки), тексты разной длины их не разъезжают.
const MENU_BUTTON_WIDTH = '50%'

export function MainMenu({ onCreateRoom, onJoinRoom, onAppearance, onSettings, onExit }: MainMenuProps) {
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
      <Button variant="primary" style={btn} onClick={onCreateRoom}>СОЗДАТЬ КОМНАТУ</Button>
      <Button variant="secondary" style={btn} onClick={onJoinRoom}>ВОЙТИ В КОМНАТУ</Button>
      <Button variant="secondary" style={btn} onClick={onAppearance}>ВНЕШНОСТЬ</Button>
      <Button variant="secondary" style={btn} onClick={onSettings}>НАСТРОЙКИ</Button>
      {/* Выход — только в Electron: в браузере window.close() для обычной вкладки запрещён политикой. */}
      {IS_ELECTRON && <Button variant="ghost" style={btn} onClick={onExit}>ВЫХОД</Button>}
    </div>
  )
}
