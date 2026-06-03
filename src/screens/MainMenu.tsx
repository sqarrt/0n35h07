import { Button } from '../ui/Button'

interface MainMenuProps {
  onCreateLobby: () => void
  onJoinLobby: () => void
  onSettings: () => void
}

export function MainMenu({ onCreateLobby, onJoinLobby, onSettings }: MainMenuProps) {
  return (
    <div className="screen">
      <div className="menu-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
        <Button variant="secondary" onClick={onSettings}>НАСТРОЙКИ</Button>
      </div>
    </div>
  )
}
