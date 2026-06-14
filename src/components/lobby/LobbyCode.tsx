import { useState, type RefObject, type CSSProperties } from 'react'
import { useT } from '../../i18n'

const COPIED_MS = 1500
const LABEL: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem', textTransform: 'uppercase' }   // как подпись поля в Настройках
const INPUT: CSSProperties = { fontSize: '1.1rem', letterSpacing: '0.22em', padding: '0.4rem 0.9rem', width: '12rem', textAlign: 'center', textTransform: 'uppercase' }

interface LobbyCodeProps {
  isHost: boolean
  code: string | null
  codeInput: string
  inputRef: RefObject<HTMLInputElement | null>
  onCodeInput: (v: string) => void
  onSubmit: () => void
}

/** Код хоста: один инпут в обеих ролях (у хоста readonly с его кодом, у клиента — ввод кода хоста). Справа — копирование. */
export function LobbyCode({ isHost, code, codeInput, inputRef, onCodeInput, onSubmit }: LobbyCodeProps) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const value = isHost ? (code ?? '') : codeInput
  const copy = () => { if (!value) return; void navigator.clipboard?.writeText(value).catch(() => { /* clipboard недоступен */ }); setCopied(true); setTimeout(() => setCopied(false), COPIED_MS) }

  return (
    <div className="lobby-code">
      <div style={LABEL}>{t.lobbyCodePlaceholder}</div>
      <div className="lobby-code-row">
        <input
          ref={inputRef}
          className="input" data-testid="lobby-code-input"
          value={value} maxLength={4} readOnly={isHost}
          onChange={e => onCodeInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
          style={INPUT}
        />
        <button className="lobby-copy-btn" data-testid="lobby-code-copy" title={t.roomCopyTooltip} onClick={copy}>{copied ? '✓' : '⧉'}</button>
      </div>
    </div>
  )
}
