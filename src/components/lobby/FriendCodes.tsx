import { useState, type RefObject, type CSSProperties } from 'react'
import { useT } from '../../i18n'

const COPIED_MS = 1500
const LABEL: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem', textTransform: 'uppercase' }
const INPUT: CSSProperties = { fontSize: '1.1rem', letterSpacing: '0.22em', padding: '0.4rem 0.9rem', width: '12rem', textAlign: 'center', textTransform: 'uppercase' }

interface FriendCodesProps {
  isHost: boolean
  myCode: string | null         // твой host-код (показываем, пока ты host)
  friendInput: string           // введённый код друга
  inputRef: RefObject<HTMLInputElement | null>
  onFriendInput: (v: string) => void
  onSubmit: () => void          // Enter в поле кода друга = ВОЙТИ
}

/** Блок режима «С другом»: сверху твой код (копировать), ниже — поле кода друга. */
export function FriendCodes({ isHost, myCode, friendInput, inputRef, onFriendInput, onSubmit }: FriendCodesProps) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = () => { if (!myCode) return; void navigator.clipboard?.writeText(myCode).catch(() => { /* clipboard недоступен */ }); setCopied(true); setTimeout(() => setCopied(false), COPIED_MS) }

  return (
    <div className="lobby-friend">
      {isHost && (
        <div className="lobby-code">
          <div style={LABEL}>{t.lobbyMyCode}</div>
          <div className="lobby-code-row">
            <input className="input" data-testid="lobby-my-code" value={myCode ?? ''} readOnly maxLength={4} style={INPUT} />
            <button className="lobby-copy-btn" data-testid="lobby-code-copy" title={t.roomCopyTooltip} onClick={copy}>{copied ? '✓' : '⧉'}</button>
          </div>
        </div>
      )}
      <div className="lobby-code">
        <div style={LABEL}>{t.lobbyFriendCode}</div>
        <div className="lobby-code-row">
          <input
            ref={inputRef}
            className="input" data-testid="lobby-friend-code"
            value={friendInput} maxLength={4}
            onChange={e => onFriendInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
            style={INPUT}
          />
        </div>
      </div>
    </div>
  )
}
