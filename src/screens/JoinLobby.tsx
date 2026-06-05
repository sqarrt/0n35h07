import { useState } from 'react'
import { Button } from '../ui/Button'

export type JoinStatus = 'idle' | 'searching' | 'found' | 'failed-find' | 'failed-connect'

interface JoinLobbyProps {
  status: JoinStatus
  onJoin: (code: string) => void
  onBack: () => void
}

export function JoinLobby({ status, onJoin, onBack }: JoinLobbyProps) {
  const [code, setCode] = useState('')
  const busy = status === 'searching' || status === 'found'   // идёт попытка — ввод/кнопка заблокированы
  const failed = status === 'failed-find' || status === 'failed-connect'
  const handleJoin = () => { if (!busy && code.trim().length > 0) onJoin(code.trim().toUpperCase()) }

  // Бегущая обводка: акцент при поиске, зелёная при «лобби найдено», красный контур при ошибке.
  const wrapState = status === 'searching' ? ' is-connecting'
    : status === 'found' ? ' is-found'
    : failed ? ' is-error' : ''

  const statusText =
    status === 'searching' ? 'ПОИСК ЛОББИ…'
    : status === 'found' ? 'ЛОББИ НАЙДЕНО · ПОДКЛЮЧЕНИЕ…'
    : status === 'failed-find' ? `ЛОББИ ${code} НЕ НАЙДЕНО`
    : status === 'failed-connect' ? 'НЕ УДАЛОСЬ ПОДКЛЮЧИТЬСЯ'
    : ''
  const statusClass =
    status === 'searching' ? ' connecting'
    : status === 'found' ? ' found'
    : failed ? ' failed' : ''

  return (
    <div className="panel-fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', margin: '0 0 0.8rem' }}>
        ВОЙТИ В ЛОББИ
      </h2>
      <div className="accent-rule" style={{ marginBottom: '1.6rem' }} />
      <div style={{ color: 'var(--muted)', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '0.8rem', fontFamily: 'var(--ui-font)' }}>
        КОД ЛОББИ
      </div>

      <div className={`code-wrap${wrapState}`}>
        <input
          className="input"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          maxLength={4}
          autoFocus
          disabled={busy}
          style={{
            fontSize: '2rem', letterSpacing: '0.5em', textIndent: code.length > 0 ? '0.5em' : '0',
            textAlign: 'center', padding: '0.5rem 1rem', boxSizing: 'border-box',
          }}
        />
        <svg className="code-run" viewBox="0 0 240 64">
          <rect x="1.5" y="1.5" width="237" height="61" pathLength="100" />
        </svg>
      </div>

      <div className={`join-status${statusClass}`}>{statusText}</div>

      <Button variant="primary" disabled={busy || code.trim().length === 0} onClick={handleJoin}>ВОЙТИ</Button>
      <Button variant="ghost" onClick={onBack}>НАЗАД</Button>
    </div>
  )
}
