import { Button } from '../ui/Button'
import { IS_ELECTRON } from '../platform'

interface MainMenuProps {
  onCreateLobby: () => void
  onJoinLobby: () => void
  onAppearance: () => void
  onSettings: () => void
  onExit: () => void
}

export function MainMenu({ onCreateLobby, onJoinLobby, onAppearance, onSettings, onExit }: MainMenuProps) {
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
      <Button variant="primary" onClick={onCreateLobby}>СОЗДАТЬ ЛОББИ</Button>
      <Button variant="secondary" onClick={onJoinLobby}>ВОЙТИ В ЛОББИ</Button>
      <Button variant="secondary" onClick={onAppearance}>ВНЕШНОСТЬ</Button>
      <Button variant="secondary" onClick={onSettings}>НАСТРОЙКИ</Button>
      {/* Выход — только в Electron: в браузере window.close() для обычной вкладки запрещён политикой. */}
      {IS_ELECTRON && <Button variant="ghost" onClick={onExit}>ВЫХОД</Button>}
    </div>
  )
}
