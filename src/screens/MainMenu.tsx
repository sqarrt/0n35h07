import { btn, screenOverlay } from './styles'

interface MainMenuProps {
  onCreateLobby: () => void
  onJoinLobby: () => void
  onSettings: () => void
}

export function MainMenu({ onCreateLobby, onJoinLobby, onSettings }: MainMenuProps) {
  return (
    <div style={screenOverlay}>
      <h1 style={{
        fontSize: '4rem', fontWeight: 'bold',
        letterSpacing: '0.3em', color: '#4af',
        marginBottom: '3rem', marginTop: 0,
        textShadow: '0 0 30px rgba(68,170,255,0.5)',
      }}>
        ONESHOT
      </h1>
      <button style={btn} onClick={onCreateLobby}>СОЗДАТЬ ЛОББИ</button>
      <button style={btn} onClick={onJoinLobby}>ВОЙТИ В ЛОББИ</button>
      <button style={btn} onClick={onSettings}>НАСТРОЙКИ</button>
    </div>
  )
}
