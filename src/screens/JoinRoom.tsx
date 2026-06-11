import { useState } from 'react'
import { Button } from '../ui/Button'
import { useT } from '../i18n'

export type JoinStatus = 'idle' | 'searching' | 'found' | 'failed-find' | 'failed-connect'

interface JoinRoomProps {
  status: JoinStatus
  onJoin: (code: string) => void
  onBack: () => void
}

export function JoinRoom({ status, onJoin, onBack }: JoinRoomProps) {
  const t = useT()
  const [code, setCode] = useState('')
  const busy = status === 'searching' || status === 'found'   // идёт попытка — ввод/кнопка заблокированы
  const failed = status === 'failed-find' || status === 'failed-connect'
  const handleJoin = () => { if (!busy && code.trim().length > 0) onJoin(code.trim().toUpperCase()) }

  // Бегущая обводка: акцент при поиске, зелёная при «комната найдена», красный контур при ошибке.
  const wrapState = status === 'searching' ? ' is-connecting'
    : status === 'found' ? ' is-found'
    : failed ? ' is-error' : ''

  const statusText =
    status === 'searching' ? t.joinStatusSearching
    : status === 'found' ? t.joinStatusFound
    : status === 'failed-find' ? t.joinStatusNotFound(code)
    : status === 'failed-connect' ? t.joinStatusFailedConnect
    : ''
  const statusClass =
    status === 'searching' ? ' connecting'
    : status === 'found' ? ' found'
    : failed ? ' failed' : ''

  return (
    <div className="panel-fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <h2 data-testid="join-title" style={{ color: 'var(--accent)', letterSpacing: '0.2em', margin: '0 0 0.8rem' }}>
        {t.joinTitle}
      </h2>
      <div className="accent-rule" style={{ marginBottom: '1.6rem' }} />
      <div style={{ color: 'var(--muted)', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '0.8rem', fontFamily: 'var(--ui-font)' }}>
        {t.joinCodeLabel}
      </div>

      <div className={`code-wrap${wrapState}`}>
        <input
          data-testid="join-code-input"
          className="input"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          maxLength={4}
          autoFocus
          spellCheck={false}
          autoComplete="off"
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

      <div data-testid="join-status" className={`join-status${statusClass}`}>{statusText}</div>

      <Button data-testid="join-submit" variant="primary" disabled={busy || code.trim().length === 0} onClick={handleJoin}>{t.joinSubmit}</Button>
      <Button data-testid="join-back" variant="ghost" onClick={onBack}>{t.roomBack}</Button>
    </div>
  )
}
