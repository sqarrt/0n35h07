import { useState } from 'react'
import { Button } from '../ui/Button'

interface JoinLobbyProps {
  onJoin: (code: string) => void
  onBack: () => void
}

export function JoinLobby({ onJoin, onBack }: JoinLobbyProps) {
  const [code, setCode] = useState('')
  const handleJoin = () => { if (code.trim().length > 0) onJoin(code.trim().toUpperCase()) }

  return (
    <div className="screen">
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', margin: '0 0 0.8rem' }}>
        ВОЙТИ В ЛОББИ
      </h2>
      <div className="accent-rule" style={{ marginBottom: '1.6rem' }} />
      <div style={{ color: 'var(--muted)', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '0.8rem', fontFamily: 'var(--ui-font)' }}>
        КОД ЛОББИ
      </div>
      <input
        className="input"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
        onKeyDown={e => e.key === 'Enter' && handleJoin()}
        maxLength={4}
        autoFocus
        style={{
          fontSize: '2rem', letterSpacing: '0.5em', textIndent: code.length > 0 ? '0.5em' : '0',
          textAlign: 'center', padding: '0.5rem 1rem', width: '15rem',
          boxSizing: 'border-box', marginBottom: '1.6rem',
        }}
      />
      <Button variant="primary" disabled={code.trim().length === 0} onClick={handleJoin}>ВОЙТИ</Button>
      <Button variant="ghost" onClick={onBack}>НАЗАД</Button>
    </div>
  )
}
