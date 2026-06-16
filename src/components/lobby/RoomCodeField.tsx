import { useState, type RefObject, type CSSProperties } from 'react'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import { randomRoomCode } from '../../net/roomCode'

const COPIED_MS = 1500
const LABEL: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem', textTransform: 'uppercase' }
const INPUT: CSSProperties = { fontSize: '1.1rem', letterSpacing: '0.22em', padding: '0.4rem 0.9rem', width: '12rem', textAlign: 'center', textTransform: 'uppercase' }

interface RoomCodeFieldProps {
  value: string
  inputRef: RefObject<HTMLInputElement | null>
  onChange: (v: string) => void
  onSubmit: () => void          // Enter в поле = ПОИСК
}

/** Поле кода комнаты для вкладки «С другом»: общий код у обоих + кнопки случайного кода и копирования. */
export function RoomCodeField({ value, inputRef, onChange, onSubmit }: RoomCodeFieldProps) {
  const t = useT()
  const sfx = useSfx()
  const [copied, setCopied] = useState(false)
  const roll = () => { sfx.play2D('ui_toggle'); onChange(randomRoomCode()) }
  const copy = () => {
    const c = value.trim().toUpperCase()
    if (!c) return
    void navigator.clipboard?.writeText(c).catch(() => { /* clipboard недоступен */ })
    setCopied(true); setTimeout(() => setCopied(false), COPIED_MS)
  }
  return (
    <div className="lobby-code">
      <div style={LABEL}>{t.lobbyRoomCode}</div>
      <div className="lobby-code-row">
        <input
          ref={inputRef}
          className="input" data-testid="lobby-room-code"
          value={value} maxLength={4}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
          style={INPUT}
        />
        <button className="lobby-copy-btn" data-testid="lobby-room-random" title={t.lobbyRandomCode} onClick={roll}>⚄</button>
        <button className="lobby-copy-btn" data-testid="lobby-code-copy" title={t.roomCopyTooltip} onClick={copy}>{copied ? '✓' : '⧉'}</button>
      </div>
    </div>
  )
}
