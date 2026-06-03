import { useState } from 'react'
import { Button } from '../ui/Button'

type JoinStatus = 'idle' | 'connecting' | 'failed'

interface JoinLobbyProps {
  status: JoinStatus
  onJoin: (code: string) => void
  onBack: () => void
}

export function JoinLobby({ status, onJoin, onBack }: JoinLobbyProps) {
  const [code, setCode] = useState('')
  const connecting = status === 'connecting'
  const failed = status === 'failed'
  const handleJoin = () => { if (!connecting && code.trim().length > 0) onJoin(code.trim().toUpperCase()) }

  return (
    <div className="screen">
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', margin: '0 0 0.8rem' }}>
        ВОЙТИ В ЛОББИ
      </h2>
      <div className="accent-rule" style={{ marginBottom: '1.6rem' }} />
      <div style={{ color: 'var(--muted)', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '0.8rem', fontFamily: 'var(--ui-font)' }}>
        КОД ЛОББИ
      </div>

      <div className={`code-wrap${connecting ? ' is-connecting' : ''}${failed ? ' is-error' : ''}`}>
        <input
          className="input"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          maxLength={4}
          autoFocus
          disabled={connecting}
          style={{
            fontSize: '2rem', letterSpacing: '0.5em', textIndent: code.length > 0 ? '0.5em' : '0',
            textAlign: 'center', padding: '0.5rem 1rem', boxSizing: 'border-box',
          }}
        />
        <svg className="code-run" viewBox="0 0 240 64">
          <rect x="1.5" y="1.5" width="237" height="61" pathLength="100" />
        </svg>
      </div>

      <div className={`join-status${connecting ? ' connecting' : ''}${failed ? ' failed' : ''}`}>
        {connecting ? 'ПОДКЛЮЧЕНИЕ…' : failed ? `ЛОББИ ${code} НЕ ОТВЕЧАЕТ` : ''}
      </div>

      <Button variant="primary" disabled={connecting || code.trim().length === 0} onClick={handleJoin}>ВОЙТИ</Button>
      <Button variant="ghost" onClick={onBack}>НАЗАД</Button>
    </div>
  )
}
