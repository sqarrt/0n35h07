import { btn, dimBtn, screenOverlay } from './styles'

interface LobbyProps {
  lobbyCode: string
  botCount: number
  onStart: () => void
  onBack: () => void
}

export function Lobby({ lobbyCode, botCount, onStart, onBack }: LobbyProps) {
  const participants = ['Игрок', ...Array.from({ length: botCount }, (_, i) => `Бот ${i + 1}`)]

  return (
    <div style={screenOverlay}>
      <h2 style={{ color: '#4af', letterSpacing: '0.2em', marginBottom: '0.5rem', marginTop: 0 }}>
        ЛОББИ
      </h2>
      <div style={{ color: '#556', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '2rem' }}>
        КОД: {lobbyCode}
      </div>

      <div style={{ marginBottom: '2rem', minWidth: '220px' }}>
        {participants.map((name, i) => (
          <div key={i} style={{
            padding: '0.5rem 1rem',
            borderBottom: '1px solid #1a2030',
            color: i === 0 ? '#ccd' : '#778',
            fontSize: '0.9rem',
            letterSpacing: '0.05em',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <span style={{ color: i === 0 ? '#4af' : '#445', fontSize: '0.6rem' }}>●</span>
            {name}
          </div>
        ))}
      </div>

      <button style={btn} onClick={onStart}>НАЧАТЬ ИГРУ</button>
      <button style={dimBtn} onClick={onBack}>НАЗАД</button>
    </div>
  )
}
