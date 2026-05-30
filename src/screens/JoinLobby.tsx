import { useState } from 'react'
import { btn, dimBtn, screenOverlay } from './styles'

interface JoinLobbyProps {
  onJoin: (code: string) => void
  onBack: () => void
}

export function JoinLobby({ onJoin, onBack }: JoinLobbyProps) {
  const [code, setCode] = useState('')

  const handleJoin = () => {
    if (code.trim().length > 0) onJoin(code.trim().toUpperCase())
  }

  return (
    <div style={screenOverlay}>
      <h2 style={{ color: '#4af', letterSpacing: '0.2em', marginBottom: '2rem', marginTop: 0 }}>
        ВОЙТИ В ЛОББИ
      </h2>

      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ color: '#556', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '0.8rem' }}>
          КОД ЛОББИ
        </div>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          maxLength={4}
          autoFocus
          style={{
            background: 'transparent',
            border: '1px solid #4af',
            color: '#ccd',
            fontFamily: 'monospace',
            fontSize: '2rem',
            letterSpacing: '0.5em',
            textAlign: 'center',
            padding: '0.5rem 1rem',
            width: '10rem',
            outline: 'none',
          }}
        />
      </div>

      <button style={{ ...btn, opacity: code.trim().length === 0 ? 0.4 : 1 }} onClick={handleJoin}>
        ВОЙТИ
      </button>
      <button style={dimBtn} onClick={onBack}>НАЗАД</button>
    </div>
  )
}
